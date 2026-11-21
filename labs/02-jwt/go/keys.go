package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"math/big"
)

// Keys is the ONE signing key of this lab. Both implementations load the same lab02.keys row, so a token
// signed by Go verifies in TS and the other way round. The PEM strings are stored and used verbatim.
type Keys struct {
	KID        string
	PrivatePEM string // PKCS#8 "PRIVATE KEY"
	PublicPEM  string // SPKI "PUBLIC KEY"; also (deliberately, for the key-confusion demo) the naive HS256 secret
	Private    *rsa.PrivateKey
	Public     *rsa.PublicKey
}

// generateKeys makes a fresh RSA-2048 pair. pem.EncodeToMemory yields LF line endings and a trailing newline.
func generateKeys() (*Keys, error) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}
	privDER, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		return nil, err
	}
	pubDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		return nil, err
	}
	return &Keys{
		KID:        kidFromSPKI(pubDER),
		PrivatePEM: string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privDER})),
		PublicPEM:  string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER})),
		Private:    priv,
		Public:     &priv.PublicKey,
	}, nil
}

// kidFromSPKI is the first 16 chars of base64url(sha256(DER SPKI)): same recipe in the TS lab.
func kidFromSPKI(der []byte) string {
	sum := sha256.Sum256(der)
	return base64.RawURLEncoding.EncodeToString(sum[:])[:16]
}

func kidFromPublicPEM(publicPEM string) (string, error) {
	block, _ := pem.Decode([]byte(publicPEM))
	if block == nil || block.Type != "PUBLIC KEY" {
		return "", errors.New("not a PUBLIC KEY PEM")
	}
	return kidFromSPKI(block.Bytes), nil
}

// parseKeys rebuilds Keys from a stored row (the stored kid and PEM strings win; nothing is re-encoded).
func parseKeys(kid, privatePEM, publicPEM string) (*Keys, error) {
	pb, _ := pem.Decode([]byte(privatePEM))
	ub, _ := pem.Decode([]byte(publicPEM))
	if pb == nil || ub == nil {
		return nil, errors.New("stored key PEM is invalid")
	}
	priv, err := x509.ParsePKCS8PrivateKey(pb.Bytes)
	if err != nil {
		return nil, err
	}
	pub, err := x509.ParsePKIXPublicKey(ub.Bytes)
	if err != nil {
		return nil, err
	}
	rp, ok1 := priv.(*rsa.PrivateKey)
	ru, ok2 := pub.(*rsa.PublicKey)
	if !ok1 || !ok2 {
		return nil, errors.New("stored keys are not RSA")
	}
	return &Keys{KID: kid, PrivatePEM: privatePEM, PublicPEM: publicPEM, Private: rp, Public: ru}, nil
}

// JWK field order matches the contract: kty, n, e, kid, alg, use.
type jwk struct {
	Kty string `json:"kty"`
	N   string `json:"n"`
	E   string `json:"e"`
	Kid string `json:"kid"`
	Alg string `json:"alg"`
	Use string `json:"use"`
}

type jwks struct {
	Keys []jwk `json:"keys"`
}

func (k *Keys) JWKS() jwks {
	e := base64.RawURLEncoding.EncodeToString(big.NewInt(int64(k.Public.E)).Bytes())
	n := base64.RawURLEncoding.EncodeToString(k.Public.N.Bytes())
	return jwks{Keys: []jwk{{Kty: "RSA", N: n, E: e, Kid: k.KID, Alg: "RS256", Use: "sig"}}}
}
