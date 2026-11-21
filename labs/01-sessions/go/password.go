package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"
	"sync"

	"golang.org/x/crypto/argon2"
)

// Argon2id parameters shared by every lab and the academy: m=19456 KiB, t=2, p=1, 16-byte salt, 32-byte hash.
const (
	argonMemory  = 19456
	argonTime    = 2
	argonThreads = 1
	saltLen      = 16
	keyLen       = 32
)

// PHC strings use the STANDARD base64 alphabet without padding (what @node-rs/argon2 emits and reads).
var phcB64 = base64.RawStdEncoding

func hashPassword(password string) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, keyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads, phcB64.EncodeToString(salt), phcB64.EncodeToString(key)), nil
}

// verifyPassword parses the PHC string (using ITS parameters, so old hashes keep working) and
// compares in constant time. Any malformed input is simply "does not verify".
func verifyPassword(phc, password string) bool {
	p := strings.Split(phc, "$") // "", argon2id, v=19, m=..,t=..,p=.., salt, hash
	if len(p) != 6 || p[0] != "" || p[1] != "argon2id" {
		return false
	}
	var version int
	if n, err := fmt.Sscanf(p[2], "v=%d", &version); n != 1 || err != nil || version != argon2.Version {
		return false
	}
	var m, t uint32
	var par uint8
	if n, err := fmt.Sscanf(p[3], "m=%d,t=%d,p=%d", &m, &t, &par); n != 3 || err != nil || m == 0 || t == 0 || par == 0 {
		return false
	}
	salt, err1 := phcB64.DecodeString(p[4])
	want, err2 := phcB64.DecodeString(p[5])
	if err1 != nil || err2 != nil || len(want) == 0 {
		return false
	}
	got := argon2.IDKey([]byte(password), salt, t, m, par, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1
}

var (
	dummyOnce sync.Once
	dummyPHC  string
)

// dummyVerify burns the same argon2 time as a real check, so an unknown email costs what a wrong password does.
func dummyVerify(password string) {
	dummyOnce.Do(func() { dummyPHC, _ = hashPassword("dummy-password-for-timing") })
	verifyPassword(dummyPHC, password)
}
