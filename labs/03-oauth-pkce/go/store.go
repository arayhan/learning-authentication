package main

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Keep this DDL byte-for-byte in sync with labs/03-oauth-pkce/ts/src/store.ts.
const ddl = `
CREATE SCHEMA IF NOT EXISTS lab03;
CREATE TABLE IF NOT EXISTS lab03.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS lab03.keys (
  id int PRIMARY KEY CHECK (id = 1),
  kid text NOT NULL,
  private_pem text NOT NULL,
  public_pem text NOT NULL
);
CREATE TABLE IF NOT EXISTS lab03.auth_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text,
  scope text NOT NULL,
  user_id uuid NOT NULL REFERENCES lab03.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE TABLE IF NOT EXISTS lab03.access_tokens (
  jti text PRIMARY KEY,
  code_hash text REFERENCES lab03.auth_codes(code_hash) ON DELETE CASCADE,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS access_tokens_code ON lab03.access_tokens (code_hash);
`

const (
	seedEmail    = "alice@example.com"
	seedPassword = "correct-horse-battery"
)

type Store struct {
	db   *pgxpool.Pool
	keys *Keys
}

// openStore creates the schema, loads (or creates) the shared signing key, and seeds alice.
func openStore(ctx context.Context, url string) (*Store, error) {
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	s := &Store{db: db}
	if err := s.init(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) init(ctx context.Context) error {
	// Go and TS may start at the same moment: serialize the DDL so CREATE ... IF NOT EXISTS cannot race.
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('lab03.ddl'))`); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, ddl); err != nil { // no args: simple protocol, so multiple statements are fine
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}

	// Generate, insert-if-absent, then READ BACK: whoever inserted first wins and every process uses that row.
	fresh, err := generateKeys()
	if err != nil {
		return err
	}
	if _, err = s.db.Exec(ctx, `INSERT INTO lab03.keys (id, kid, private_pem, public_pem) VALUES (1, $1, $2, $3) ON CONFLICT (id) DO NOTHING`,
		fresh.KID, fresh.PrivatePEM, fresh.PublicPEM); err != nil {
		return err
	}
	var kid, priv, pub string
	if err = s.db.QueryRow(ctx, `SELECT kid, private_pem, public_pem FROM lab03.keys WHERE id = 1`).Scan(&kid, &priv, &pub); err != nil {
		return err
	}
	if s.keys, err = parseKeys(kid, priv, pub); err != nil {
		return err
	}

	phc, err := hashPassword(seedPassword)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `INSERT INTO lab03.users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`, seedEmail, phc)
	return err
}

// FindUser returns found=false (and no error) for an unknown email.
func (s *Store) FindUser(ctx context.Context, email string) (id, phc string, found bool, err error) {
	err = s.db.QueryRow(ctx, `SELECT id::text, password_hash FROM lab03.users WHERE email = $1`, email).Scan(&id, &phc)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", false, nil
	}
	return id, phc, err == nil, err
}

// CodeGrant is everything an authorization code is bound to.
type CodeGrant struct {
	ClientID, RedirectURI, Scope, UserID string
	Challenge                            *string // nil only for codes issued by the vulnerable /authorize
}

// SaveCode stores sha256(code), never the code. Codes live 60 seconds.
func (s *Store) SaveCode(ctx context.Context, code string, g CodeGrant) error {
	_, err := s.db.Exec(ctx, `
INSERT INTO lab03.auth_codes (code_hash, client_id, redirect_uri, code_challenge, scope, user_id, expires_at)
VALUES ($1, $2, $3, $4, $5, $6::uuid, now() + interval '60 seconds')`,
		sha256hex(code), g.ClientID, g.RedirectURI, g.Challenge, g.Scope, g.UserID)
	return err
}

// CodeRedirectURI is what the attacker in /__attack/intercept saw in the redirect URL (empty if the code is unknown).
func (s *Store) CodeRedirectURI(ctx context.Context, code string) (string, error) {
	var uri string
	err := s.db.QueryRow(ctx, `SELECT redirect_uri FROM lab03.auth_codes WHERE code_hash = $1`, sha256hex(code)).Scan(&uri)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return uri, err
}

// Redeem exchanges a code for an access-token record, atomically: the code row is locked (FOR UPDATE), so two
// concurrent redemptions cannot both succeed. oauthErr is "" on success, else the RFC 6749 §5.2 error.
//
// Presenting a code that was already redeemed is treated as theft: every access token issued from it is revoked
// (RFC 6749 §4.1.2) and that revocation is COMMITTED even though the request fails. A failed PKCE check, an
// expired code or a mismatched redirect_uri changes nothing, so a thief cannot burn the real client's code.
func (s *Store) Redeem(ctx context.Context, code, clientID, redirectURI, verifier, jti string) (scope, userID, oauthErr string, err error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", "", "", err
	}
	defer tx.Rollback(ctx)

	hash := sha256hex(code)
	var g CodeGrant
	var used, expired bool
	err = tx.QueryRow(ctx, `
SELECT client_id, redirect_uri, code_challenge, scope, user_id::text, used_at IS NOT NULL, expires_at < now()
FROM lab03.auth_codes WHERE code_hash = $1 FOR UPDATE`, hash).Scan(&g.ClientID, &g.RedirectURI, &g.Challenge, &g.Scope, &g.UserID, &used, &expired)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "invalid_grant", nil
	}
	if err != nil {
		return "", "", "", err
	}

	if used {
		if _, err = tx.Exec(ctx, `UPDATE lab03.access_tokens SET revoked_at = now() WHERE code_hash = $1 AND revoked_at IS NULL`, hash); err != nil {
			return "", "", "", err
		}
		return "", "", "invalid_grant", tx.Commit(ctx)
	}
	if expired || g.ClientID != clientID || g.RedirectURI != redirectURI {
		return "", "", "invalid_grant", nil
	}
	// A code issued WITH a challenge needs the matching verifier, in every mode. A code issued without one
	// can only come from the vulnerable /authorize and is redeemable by whoever holds it.
	if g.Challenge != nil && !verifyPKCE(*g.Challenge, verifier) {
		return "", "", "invalid_grant", nil
	}

	if _, err = tx.Exec(ctx, `UPDATE lab03.auth_codes SET used_at = now() WHERE code_hash = $1`, hash); err != nil {
		return "", "", "", err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO lab03.access_tokens (jti, code_hash) VALUES ($1, $2)`, jti, hash); err != nil {
		return "", "", "", err
	}
	return g.Scope, g.UserID, "", tx.Commit(ctx)
}

// RecordClientToken registers a client_credentials token (no code) so it shows up in the same table.
func (s *Store) RecordClientToken(ctx context.Context, jti string) error {
	_, err := s.db.Exec(ctx, `INSERT INTO lab03.access_tokens (jti, code_hash) VALUES ($1, NULL)`, jti)
	return err
}

// Revoked: a jti with no row (a token the AS never recorded) is simply not revoked.
func (s *Store) Revoked(ctx context.Context, jti string) (bool, error) {
	var revoked bool
	err := s.db.QueryRow(ctx, `SELECT revoked_at IS NOT NULL FROM lab03.access_tokens WHERE jti = $1`, jti).Scan(&revoked)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return revoked, err
}
