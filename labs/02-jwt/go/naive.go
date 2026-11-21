package main

import (
	"crypto"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
)

// naiveVerify is the DELIBERATELY BROKEN verifier used in vulnerable mode. It is shown to learners.
// Every flaw below is a real-world bug class; the secure path (verifyAccess in tokens.go) has none of them.
//
//	FLAW 1: it trusts the token's own `alg` header to decide how to verify, instead of pinning the algorithm.
//	FLAW 2: it accepts alg "none" (any capitalization): an unsigned token is "valid".
//	FLAW 3: for HS256 it uses the server's PUBLIC key text as the HMAC secret. The public key is public, so
//	        anyone can sign (this is the RS256 -> HS256 "key confusion" attack).
//	FLAW 4: it never looks at exp, aud or iss: expired tokens, and tokens meant for other APIs, are accepted.
func naiveVerify(token string, k *Keys) (map[string]any, error) {
	parts := strings.Split(token, ".")
	if len(parts) < 2 { // FLAW 2 (part): a "none" token may drop the signature segment, even its dot
		return nil, errors.New("malformed token")
	}
	var header, claims map[string]any
	if err := decodePart(parts[0], &header); err != nil {
		return nil, err
	}
	if err := decodePart(parts[1], &claims); err != nil || claims == nil {
		return nil, errors.New("bad payload")
	}
	signingInput := parts[0] + "." + parts[1]
	sig := ""
	if len(parts) > 2 {
		sig = parts[2]
	}

	alg, _ := header["alg"].(string) // FLAW 1: the attacker chose this value
	switch strings.ToLower(alg) {
	case "none": // FLAW 2: no signature required, and whatever sits in the signature slot is ignored
		return claims, nil
	case "hs256":
		mac := hmac.New(sha256.New, []byte(k.PublicPEM)) // FLAW 3: the public PEM string as the shared secret
		mac.Write([]byte(signingInput))
		got, err := base64.RawURLEncoding.DecodeString(sig)
		if err != nil || !hmac.Equal(got, mac.Sum(nil)) {
			return nil, errors.New("bad signature")
		}
		return claims, nil // FLAW 4: exp / aud / iss are never checked
	case "rs256":
		got, err := base64.RawURLEncoding.DecodeString(sig)
		if err != nil {
			return nil, errors.New("bad signature")
		}
		sum := sha256.Sum256([]byte(signingInput))
		if rsa.VerifyPKCS1v15(k.Public, crypto.SHA256, sum[:], got) != nil {
			return nil, errors.New("bad signature")
		}
		return claims, nil // FLAW 4 again
	}
	return nil, errors.New("unsupported alg")
}

func decodePart(part string, into *map[string]any) error {
	b, err := base64.RawURLEncoding.DecodeString(part)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(b, into); err != nil || *into == nil {
		return errors.New("not a JSON object")
	}
	return nil
}
