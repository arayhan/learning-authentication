package main

import (
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// Fixed vector made with Node (sha256 of the SPKI DER, base64url, first 16 chars): proves kid derivation matches the TS lab.
const (
	vectorPEM = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlZGRhtjlwLcbnzcTrfWl\nktZv/DToprCao2B4NfBrErSrkaPzEQgJJ8KR4QyBkU4LoewJ8gm47m3ZYIYP1Xvs\nBiECbocW6IMqoF4vmB1FlEtOxVDG52yVPY7QsdF2Mqgi1UPtI5han66ZGZsDeitm\nSlpNOCqc6Ppgtu8w8QeNm/ju6mQIxc5rlM2xFvbz5rPvzH/KYvIsMyQ6CCE8Y89u\n7IKtglAslMZX2OiQiZBkKDNEGcYwsoIVK+pm70/HgbEEf2drNky1CEbm6IV1QIyv\ni/1Oiun5BxFtQ6skORgUawGs3uYNSc64HnNtBZzR/gWbcoxFb5vYNRoIGPSt5jgC\nrQIDAQAB\n-----END PUBLIC KEY-----\n"
	vectorKID = "oMcF_WkYeYfMB27B"
)

func b64(v any) string {
	b, _ := json.Marshal(v)
	return base64.RawURLEncoding.EncodeToString(b)
}

func testKeys(t *testing.T) *Keys {
	t.Helper()
	k, err := generateKeys()
	if err != nil {
		t.Fatal(err)
	}
	return k
}

// claims returns valid claims; a nil override deletes the claim.
func claims(over map[string]any) map[string]any {
	now := time.Now().Unix()
	m := map[string]any{"iss": issuer, "aud": audience, "sub": "u1", "email": "a@b.io", "iat": now, "exp": now + 300, "jti": "j"}
	for k, v := range over {
		if v == nil {
			delete(m, k)
		} else {
			m[k] = v
		}
	}
	return m
}

func rs256(t *testing.T, k *Keys, h, p map[string]any) string {
	t.Helper()
	in := b64(h) + "." + b64(p)
	sum := sha256.Sum256([]byte(in))
	sig, err := rsa.SignPKCS1v15(rand.Reader, k.Private, crypto.SHA256, sum[:])
	if err != nil {
		t.Fatal(err)
	}
	return in + "." + base64.RawURLEncoding.EncodeToString(sig)
}

func hs256(secret string, h, p map[string]any) string {
	in := b64(h) + "." + b64(p)
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(in))
	return in + "." + base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func TestKidDerivationMatchesVector(t *testing.T) {
	got, err := kidFromPublicPEM(vectorPEM)
	if err != nil || got != vectorKID {
		t.Fatalf("kid = %q, %v; want %q", got, err, vectorKID)
	}
	if _, err := kidFromPublicPEM("not a pem"); err == nil {
		t.Fatal("garbage PEM must fail")
	}
}

func TestGeneratedKeysShape(t *testing.T) {
	k := testKeys(t)
	if !strings.HasPrefix(k.PrivatePEM, "-----BEGIN PRIVATE KEY-----\n") || !strings.HasSuffix(k.PrivatePEM, "-----END PRIVATE KEY-----\n") {
		t.Fatalf("private PEM is not PKCS#8 with LF + trailing newline: %q", k.PrivatePEM)
	}
	if !strings.HasPrefix(k.PublicPEM, "-----BEGIN PUBLIC KEY-----\n") || !strings.HasSuffix(k.PublicPEM, "-----END PUBLIC KEY-----\n") || strings.Contains(k.PublicPEM, "\r") {
		t.Fatalf("public PEM is not SPKI with LF + trailing newline: %q", k.PublicPEM)
	}
	if k.Private.N.BitLen() != 2048 || len(k.KID) != 16 {
		t.Fatalf("bits=%d kid=%q", k.Private.N.BitLen(), k.KID)
	}
	back, err := parseKeys(k.KID, k.PrivatePEM, k.PublicPEM)
	if err != nil || back.Private.N.Cmp(k.Private.N) != 0 || back.PublicPEM != k.PublicPEM {
		t.Fatalf("round trip failed: %v", err)
	}
	if _, err := parseKeys(k.KID, "", k.PublicPEM); err == nil {
		t.Fatal("missing private key must fail")
	}
	j := k.JWKS().Keys[0]
	if j.Kty != "RSA" || j.Alg != "RS256" || j.Use != "sig" || j.Kid != k.KID || j.E != "AQAB" || len(j.N) != 342 {
		t.Fatalf("jwk: %+v", j)
	}
}

func TestSecureVerifierAcceptsIssuedToken(t *testing.T) {
	k := testKeys(t)
	tok, err := issueAccess(k, "user-1", "a@b.io")
	if err != nil {
		t.Fatal(err)
	}
	c, err := verifyAccess(k, tok)
	if err != nil || c["sub"] != "user-1" || c["email"] != "a@b.io" || c["iss"] != issuer || c["aud"] != audience {
		t.Fatalf("claims=%v err=%v", c, err)
	}
	if h := strings.Split(tok, ".")[0]; h != b64(map[string]any{"alg": "RS256", "kid": k.KID, "typ": "JWT"}) {
		t.Fatalf("header %s", h)
	}
	if int64(c["exp"].(float64))-int64(c["iat"].(float64)) != 300 {
		t.Fatal("exp must be iat+300")
	}
}

func TestSecureVerifierRejects(t *testing.T) {
	k := testKeys(t)
	rsHdr := map[string]any{"alg": "RS256", "typ": "JWT", "kid": k.KID}
	past := time.Now().Unix() - 3600
	cases := map[string]string{
		"alg none":        b64(map[string]any{"alg": "none"}) + "." + b64(claims(nil)) + ".",
		"hs256 key conf.": hs256(k.PublicPEM, map[string]any{"alg": "HS256"}, claims(nil)),
		"expired":         rs256(t, k, rsHdr, claims(map[string]any{"iat": past - 300, "exp": past})),
		"wrong aud":       rs256(t, k, rsHdr, claims(map[string]any{"aud": "other"})),
		"wrong iss":       rs256(t, k, rsHdr, claims(map[string]any{"iss": "http://evil.test"})),
		"missing exp":     rs256(t, k, rsHdr, claims(map[string]any{"exp": nil})),
		"other key":       rs256(t, testKeys(t), rsHdr, claims(nil)),
		"garbage":         "not.a.jwt",
	}
	for name, tok := range cases {
		if _, err := verifyAccess(k, tok); err == nil {
			t.Errorf("%s: secure verifier accepted it", name)
		}
	}
	if _, err := verifyAccess(k, rs256(t, k, rsHdr, claims(nil))); err != nil {
		t.Fatalf("control token rejected: %v", err)
	}
}

func TestNaiveVerifier(t *testing.T) {
	k := testKeys(t)
	rsHdr := map[string]any{"alg": "RS256", "typ": "JWT", "kid": k.KID}
	past := time.Now().Unix() - 3600
	p := strings.Split(rs256(t, k, rsHdr, claims(nil)), ".")
	tampered := p[0] + "." + b64(claims(map[string]any{"email": "root@x.io"})) + "." + p[2]
	for name, tc := range map[string]struct {
		tok  string
		want bool
	}{
		"none empty sig":        {b64(map[string]any{"alg": "none"}) + "." + b64(claims(nil)) + ".", true},
		"none no dot":           {b64(map[string]any{"alg": "none"}) + "." + b64(claims(nil)), true},
		"none junk sig":         {b64(map[string]any{"alg": "none"}) + "." + b64(claims(nil)) + ".junk", true},
		"None (case)":           {b64(map[string]any{"alg": "None"}) + "." + b64(claims(nil)) + ".", true},
		"hs256 public key":      {hs256(k.PublicPEM, map[string]any{"alg": "HS256"}, claims(nil)), true},
		"hs256 wrong secret":    {hs256("nope", map[string]any{"alg": "HS256"}, claims(nil)), false},
		"rs256 valid":           {rs256(t, k, rsHdr, claims(nil)), true},
		"rs256 expired":         {rs256(t, k, rsHdr, claims(map[string]any{"exp": past})), true},
		"rs256 wrong aud+iss":   {rs256(t, k, rsHdr, claims(map[string]any{"aud": "x", "iss": "y"})), true},
		"rs256 tampered":        {tampered, false},
		"rs256 other key":       {rs256(t, testKeys(t), rsHdr, claims(nil)), false},
		"unknown alg":           {b64(map[string]any{"alg": "ES256"}) + "." + b64(claims(nil)) + ".x", false},
		"missing alg":           {b64(map[string]any{}) + "." + b64(claims(nil)) + ".x", false},
		"one segment":           {"abc", false},
		"bad base64":            {"!!." + b64(claims(nil)) + ".x", false},
		"payload not an object": {b64(map[string]any{"alg": "none"}) + "." + b64("str") + ".", false},
	} {
		_, err := naiveVerify(tc.tok, k)
		if (err == nil) != tc.want {
			t.Errorf("%s: accepted=%v, want %v (err=%v)", name, err == nil, tc.want, err)
		}
	}
}

func TestForge(t *testing.T) {
	k := testKeys(t)
	none, err := forge(k, "none", nil, map[string]any{"sub": "evil"})
	if err != nil || !strings.HasSuffix(none, ".") || strings.Count(none, ".") != 2 {
		t.Fatalf("none: %q %v", none, err)
	}
	if c, err := naiveVerify(none, k); err != nil || c["sub"] != "evil" || c["iss"] != issuer || c["aud"] != audience || c["email"] == nil || c["jti"] == nil {
		t.Fatalf("none claims: %v %v", c, err)
	}
	hs, _ := forge(k, "hs256-with-public-key", nil, nil)
	if _, err := verifyAccess(k, hs); err == nil {
		t.Fatal("secure accepted the key-confusion token")
	}
	if _, err := naiveVerify(hs, k); err != nil {
		t.Fatal(err)
	}
	exp, _ := forge(k, "expired", nil, nil)
	if _, err := verifyAccess(k, exp); err == nil {
		t.Fatal("secure accepted the expired token")
	}
	if c, err := naiveVerify(exp, k); err != nil || int64(c["exp"].(float64)) >= time.Now().Unix() {
		t.Fatalf("expired token should verify naively with a past exp: %v %v", c, err)
	}
	if _, err := forge(k, "rot13", nil, nil); err == nil {
		t.Fatal("unknown mode must fail")
	}
}

func TestRefreshTokenAndCookieShape(t *testing.T) {
	tok := newToken()
	if len(tok) != 43 || tok == newToken() {
		t.Fatalf("token should be 32 random bytes base64url: %q", tok)
	}
	if got := hashToken("abc"); got != "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" {
		t.Fatalf("hashToken is not sha256 hex: %s", got)
	}
	if c := refreshCookie("T").String(); c != "rt=T; Path=/refresh; Max-Age=1209600; HttpOnly; SameSite=Strict" {
		t.Fatalf("cookie: %s", c)
	}
	if c := clearRefreshCookie().String(); c != "rt=; Path=/refresh; Max-Age=0; HttpOnly; SameSite=Strict" {
		t.Fatalf("clear cookie: %s", c)
	}
}
