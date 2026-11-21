package main

import (
	"strings"
	"testing"
)

// Produced by @node-rs/argon2 (Argon2id m=19456 t=2 p=1) for fixedPassword: proves Go verifies TS-made hashes.
const (
	fixedPassword = "correct horse battery staple"
	fixedPHC      = "$argon2id$v=19$m=19456,t=2,p=1$atN7oBElEYxDS7EGH0TLHg$5uGGf6yjSjhogdW3AYOo95Ktb/tM/D1c2U7GiYfdIRg"
)

func TestVerifiesNodeRsArgon2PHC(t *testing.T) {
	if !verifyPassword(fixedPHC, fixedPassword) {
		t.Fatal("fixed @node-rs/argon2 PHC did not verify")
	}
	if verifyPassword(fixedPHC, fixedPassword+"x") {
		t.Fatal("wrong password verified")
	}
}

func TestHashPasswordEmitsInteropPHC(t *testing.T) {
	phc, err := hashPassword(fixedPassword)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(phc, "$argon2id$v=19$m=19456,t=2,p=1$") || strings.Count(phc, "=") != 4 {
		t.Fatalf("unexpected PHC shape: %s", phc)
	}
	parts := strings.Split(phc, "$")
	if len(parts) != 6 || len(parts[4]) != 22 || len(parts[5]) != 43 { // unpadded b64 of 16 and 32 bytes
		t.Fatalf("salt/hash not 16/32 unpadded bytes: %s", phc)
	}
	if !verifyPassword(phc, fixedPassword) || verifyPassword(phc, "other") {
		t.Fatal("round trip failed")
	}
	phc2, _ := hashPassword(fixedPassword)
	if phc == phc2 {
		t.Fatal("salt must be random")
	}
}

func TestVerifyRejectsMalformed(t *testing.T) {
	for _, bad := range []string{
		"", "plaintext", "$argon2i$v=19$m=19456,t=2,p=1$atN7oBElEYxDS7EGH0TLHg$5uGGf6yjSjhogdW3AYOo95Ktb/tM/D1c2U7GiYfdIRg",
		"$argon2id$v=19$m=19456,t=2,p=1$!!$!!", "$argon2id$v=19$m=x,t=2,p=1$atN7oBElEYxDS7EGH0TLHg$5uGGf6yjSjhogdW3AYOo95Ktb/tM/D1c2U7GiYfdIRg",
		"$argon2id$v=19$m=19456,t=2,p=1$atN7oBElEYxDS7EGH0TLHg$",
	} {
		if verifyPassword(bad, fixedPassword) {
			t.Fatalf("malformed hash verified: %q", bad)
		}
	}
}

func TestTokenAndCookieShape(t *testing.T) {
	tok := newToken()
	if len(tok) != 43 || tok == newToken() {
		t.Fatalf("token should be 32 random bytes base64url: %q", tok)
	}
	if got := hashToken("abc"); got != "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" {
		t.Fatalf("hashToken is not sha256 hex: %s", got)
	}
	if c := sessionCookie("T").String(); c != "sid=T; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax" {
		t.Fatalf("cookie: %s", c)
	}
	if c := clearCookie().String(); c != "sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" {
		t.Fatalf("clear cookie: %s", c)
	}
}
