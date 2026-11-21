package main

import (
	"strings"
	"testing"
)

// RFC 7636 Appendix B.
const (
	rfcVerifier  = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	rfcChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
)

func TestChallengeS256MatchesRFC7636AppendixB(t *testing.T) {
	if got := challengeS256(rfcVerifier); got != rfcChallenge {
		t.Fatalf("challenge = %q, want %q", got, rfcChallenge)
	}
}

func TestVerifyPKCE(t *testing.T) {
	if !verifyPKCE(rfcChallenge, rfcVerifier) {
		t.Fatal("the RFC pair must verify")
	}
	for name, v := range map[string]string{
		"wrong verifier":      strings.Repeat("a", 43),
		"challenge as plain":  rfcChallenge,
		"empty":               "",
		"too short":           rfcVerifier[:42],
		"too long":            strings.Repeat("a", 129),
		"reserved characters": rfcVerifier[:42] + "!",
		"space":               rfcVerifier[:42] + " ",
	} {
		if verifyPKCE(rfcChallenge, v) {
			t.Errorf("%s must not verify", name)
		}
	}
	if !verifyPKCE(challengeS256(strings.Repeat("A", 128)), strings.Repeat("A", 128)) {
		t.Error("128 chars is the maximum and must verify")
	}
}

func TestChallengeFormat(t *testing.T) {
	if !challengeRe.MatchString(rfcChallenge) {
		t.Fatal("a real S256 challenge must match")
	}
	for _, c := range []string{"", rfcChallenge + "=", rfcChallenge[:42], rfcChallenge + "a", strings.Repeat("+", 43)} {
		if challengeRe.MatchString(c) {
			t.Errorf("%q must not match", c)
		}
	}
}

func TestRedirectMatching(t *testing.T) {
	spa := clients["demo-spa"]
	ok := "http://localhost:4113/callback"
	if !spa.redirectOK(ok, false) || !spa.redirectOK("http://localhost:4213/callback", false) {
		t.Fatal("registered URIs must match exactly")
	}
	for _, u := range []string{ok + "/evil", ok + "?x=1", ok + "/", "http://localhost:4113/", "http://evil.test/callback", ""} {
		if spa.redirectOK(u, false) {
			t.Errorf("secure mode must reject %q", u)
		}
	}
	if !spa.redirectOK(ok+"/evil", true) || !spa.redirectOK(ok+"?x=1", true) {
		t.Error("vulnerable mode accepts anything that starts with a registered URI")
	}
	if spa.redirectOK("http://evil.test/callback", true) || spa.redirectOK("http://localhost:4113/", true) {
		t.Error("vulnerable mode is a prefix match, not a free-for-all")
	}
}

func TestParseScope(t *testing.T) {
	got, ok := parseScope("  photos.read   profile photos.read ")
	if !ok || strings.Join(got, " ") != "photos.read profile" {
		t.Fatalf("got %v %v", got, ok)
	}
	if _, ok := parseScope("   "); ok {
		t.Fatal("empty scope must be rejected")
	}
	spa := clients["demo-spa"]
	if !subset([]string{"profile"}, spa.Scopes) || subset([]string{"profile", "admin"}, spa.Scopes) {
		t.Fatal("subset check wrong")
	}
}

func TestClientSecretCheck(t *testing.T) {
	b := clients["demo-backend"]
	if !b.secretOK("lab-secret") || b.secretOK("lab-secret ") || b.secretOK("") {
		t.Fatal("confidential client secret check wrong")
	}
	if clients["demo-spa"].secretOK("") {
		t.Fatal("a public client has no secret to match")
	}
}

func TestKidDerivationMatchesVector(t *testing.T) {
	// Same vector as lab02: proves the kid recipe is shared with the TS labs.
	const pem = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlZGRhtjlwLcbnzcTrfWl\nktZv/DToprCao2B4NfBrErSrkaPzEQgJJ8KR4QyBkU4LoewJ8gm47m3ZYIYP1Xvs\nBiECbocW6IMqoF4vmB1FlEtOxVDG52yVPY7QsdF2Mqgi1UPtI5han66ZGZsDeitm\nSlpNOCqc6Ppgtu8w8QeNm/ju6mQIxc5rlM2xFvbz5rPvzH/KYvIsMyQ6CCE8Y89u\n7IKtglAslMZX2OiQiZBkKDNEGcYwsoIVK+pm70/HgbEEf2drNky1CEbm6IV1QIyv\ni/1Oiun5BxFtQ6skORgUawGs3uYNSc64HnNtBZzR/gWbcoxFb5vYNRoIGPSt5jgC\nrQIDAQAB\n-----END PUBLIC KEY-----\n"
	if got, err := kidFromPublicPEM(pem); err != nil || got != "oMcF_WkYeYfMB27B" {
		t.Fatalf("kid = %q, %v", got, err)
	}
}

func TestSessionAndPendingStores(t *testing.T) {
	s := &Server{sessions: map[string]*session{}, pend: map[string]*pending{}}
	sid, sess := s.newSession("u1")
	if got := s.session(sid); got != sess || len(sess.csrf) != 43 {
		t.Fatal("session lookup or csrf token wrong")
	}
	if s.session("nope") != nil || s.session("") != nil {
		t.Fatal("unknown session id must not resolve")
	}
	rid := s.newPending(&pending{clientID: "demo-spa"})
	if s.consumePending(rid, sid) != nil {
		t.Fatal("a pending request nobody logged in for must not be consumable")
	}
	if !s.bindPending(rid, sid) || s.bindPending(rid, "other") {
		t.Fatal("a pending request binds to exactly one session")
	}
	if s.consumePending(rid, "other") != nil {
		t.Fatal("another session must not consume it")
	}
	if p := s.consumePending(rid, sid); p == nil || p.clientID != "demo-spa" {
		t.Fatal("the owning session consumes it")
	}
	if s.consumePending(rid, sid) != nil {
		t.Fatal("single use")
	}
}
