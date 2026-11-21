package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
)

// Refresh tokens are opaque (not JWTs): the server must be able to revoke them, so it keeps state.
// Only sha256(token) is stored. Tokens form a FAMILY per login; each refresh retires the presented token
// (used_at) and issues a successor in the same family. A retired token coming back means it was copied:
// the whole family is revoked, so the thief AND the victim must log in again.
const refreshMaxAge = 14 * 24 * 3600 // seconds; expires_at uses the same 14 days

// newToken is 32 random bytes, base64url without padding.
func newToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err) // no entropy: nothing safe to do
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// hashToken is what the DB stores: a stolen DB dump must not contain usable refresh tokens.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Path=/refresh: the browser sends the cookie ONLY to /refresh and /refresh/logout, never with API calls.
// SameSite=Strict: never sent on cross-site requests. No Secure because the labs run on plain http://localhost;
// in production Secure is REQUIRED.
func refreshCookie(token string) *http.Cookie {
	return &http.Cookie{Name: "rt", Value: token, Path: "/refresh", MaxAge: refreshMaxAge, HttpOnly: true, SameSite: http.SameSiteStrictMode}
}

func clearRefreshCookie() *http.Cookie {
	return &http.Cookie{Name: "rt", Value: "", Path: "/refresh", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteStrictMode}
}

// NewFamily starts a refresh-token family for a fresh login.
func (s *Store) NewFamily(ctx context.Context, userID string) (string, error) {
	token := newToken()
	_, err := s.db.Exec(ctx, `
INSERT INTO lab02.refresh_tokens (id, family_id, user_id, expires_at)
VALUES ($1, gen_random_uuid(), $2::uuid, now() + interval '14 days')`, hashToken(token), userID)
	return token, err
}

// Rotate retires the presented token and issues its successor, atomically. The presented row is locked
// (FOR UPDATE), so two concurrent refreshes of the same token cannot both succeed: the loser re-reads the
// row after the winner commits, sees used_at, and takes the reuse path.
// ok=false means 401 (unknown, expired, reused or revoked). A reused or revoked token also revokes its family.
func (s *Store) Rotate(ctx context.Context, token string) (userID, email, next string, ok bool, err error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx) // no-op after Commit
	var family string
	var used, revoked, expired bool
	err = tx.QueryRow(ctx, `
SELECT r.family_id::text, r.user_id::text, u.email, r.used_at IS NOT NULL, r.revoked_at IS NOT NULL, r.expires_at <= now()
FROM lab02.refresh_tokens r JOIN lab02.users u ON u.id = r.user_id
WHERE r.id = $1 FOR UPDATE OF r`, hashToken(token)).Scan(&family, &userID, &email, &used, &revoked, &expired)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", false, nil
	}
	if err != nil {
		return
	}
	if used || revoked { // REUSE DETECTION: this token was already spent (or its family is dead)
		if _, err = tx.Exec(ctx, `UPDATE lab02.refresh_tokens SET revoked_at = now() WHERE family_id = $1::uuid AND revoked_at IS NULL`, family); err != nil {
			return
		}
		return "", "", "", false, tx.Commit(ctx) // commit: the revocation must stick even though the request fails
	}
	if expired {
		return "", "", "", false, nil
	}
	next = newToken()
	if _, err = tx.Exec(ctx, `UPDATE lab02.refresh_tokens SET used_at = now() WHERE id = $1`, hashToken(token)); err != nil {
		return
	}
	if _, err = tx.Exec(ctx, `
INSERT INTO lab02.refresh_tokens (id, family_id, user_id, expires_at) VALUES ($1, $2::uuid, $3::uuid, now() + interval '14 days')`,
		hashToken(next), family, userID); err != nil {
		return
	}
	return userID, email, next, true, tx.Commit(ctx)
}

// RevokeFamily kills every token in the family of the presented one (used or not). Unknown tokens are a no-op.
func (s *Store) RevokeFamily(ctx context.Context, token string) error {
	_, err := s.db.Exec(ctx, `
UPDATE lab02.refresh_tokens SET revoked_at = now()
WHERE revoked_at IS NULL AND family_id = (SELECT family_id FROM lab02.refresh_tokens WHERE id = $1)`, hashToken(token))
	return err
}
