package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"regexp"
)

// RFC 7636: a verifier is 43-128 characters of the unreserved set; an S256 challenge is the 43-char
// base64url of a SHA-256 digest.
var (
	verifierRe  = regexp.MustCompile(`^[A-Za-z0-9\-._~]{43,128}$`)
	challengeRe = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)
)

// challengeS256 is BASE64URL(SHA256(ASCII(verifier))), no padding.
func challengeS256(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// verifyPKCE: the verifier must be well formed AND hash to the stored challenge. Only S256 exists here, so a
// client that sends the challenge itself as the "plain" verifier simply fails.
func verifyPKCE(challenge, verifier string) bool {
	if !verifierRe.MatchString(verifier) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(challengeS256(verifier)), []byte(challenge)) == 1
}

// newToken is 32 random bytes, base64url without padding (authorization codes, session ids, CSRF tokens, jti).
func newToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err) // no entropy: nothing safe to do
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// sha256hex is what the DB stores for a code: a stolen DB dump must not contain redeemable codes.
func sha256hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
