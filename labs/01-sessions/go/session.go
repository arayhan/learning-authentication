package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
)

const sessionMaxAge = 3600 // seconds; the DB expires_at uses the same hour

// newToken is 32 random bytes, base64url without padding. Used for session ids and CSRF tokens.
func newToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err) // no entropy: nothing safe to do
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// hashToken is what the DB stores: a stolen DB dump must not contain usable session cookies.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// No Secure attribute because the labs run on plain http://localhost. In production Secure is REQUIRED,
// otherwise the cookie also travels over http and can be sniffed.
func sessionCookie(token string) *http.Cookie {
	return &http.Cookie{Name: "sid", Value: token, Path: "/", MaxAge: sessionMaxAge, HttpOnly: true, SameSite: http.SameSiteLaxMode}
}

func clearCookie() *http.Cookie {
	return &http.Cookie{Name: "sid", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode}
}

func csrfEqual(a, b string) bool { return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1 }

type Session struct{ UserID, Email, CSRF string }

// CreateSession stores sha256(token). The upsert only matters in vulnerable mode, where the caller picks the token.
func (s *Store) CreateSession(ctx context.Context, token, userID string) (csrf string, err error) {
	csrf = newToken()
	_, err = s.db.Exec(ctx, `
INSERT INTO lab01.sessions (id, user_id, csrf_token, expires_at) VALUES ($1, $2::uuid, $3, now() + interval '1 hour')
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, csrf_token = EXCLUDED.csrf_token, expires_at = EXCLUDED.expires_at`,
		hashToken(token), userID, csrf)
	return
}

// FindSession returns nil (no error) for unknown or expired sessions.
func (s *Store) FindSession(ctx context.Context, token string) (*Session, error) {
	var sess Session
	err := s.db.QueryRow(ctx, `
SELECT s.user_id::text, u.email, s.csrf_token FROM lab01.sessions s JOIN lab01.users u ON u.id = s.user_id
WHERE s.id = $1 AND s.expires_at > now()`, hashToken(token)).Scan(&sess.UserID, &sess.Email, &sess.CSRF)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &sess, err
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM lab01.sessions WHERE id = $1`, hashToken(token))
	return err
}
