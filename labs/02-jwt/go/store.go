package main

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Keep this DDL byte-for-byte in sync with labs/02-jwt/ts/src/store.ts.
const ddl = `
CREATE SCHEMA IF NOT EXISTS lab02;
CREATE TABLE IF NOT EXISTS lab02.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS lab02.keys (
  id int PRIMARY KEY CHECK (id = 1),
  kid text NOT NULL,
  private_pem text NOT NULL,
  public_pem text NOT NULL
);
CREATE TABLE IF NOT EXISTS lab02.refresh_tokens (
  id text PRIMARY KEY,
  family_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES lab02.users(id) ON DELETE CASCADE,
  used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS refresh_tokens_family ON lab02.refresh_tokens (family_id);
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
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('lab02.ddl'))`); err != nil {
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
	if _, err = s.db.Exec(ctx, `INSERT INTO lab02.keys (id, kid, private_pem, public_pem) VALUES (1, $1, $2, $3) ON CONFLICT (id) DO NOTHING`,
		fresh.KID, fresh.PrivatePEM, fresh.PublicPEM); err != nil {
		return err
	}
	var kid, priv, pub string
	if err = s.db.QueryRow(ctx, `SELECT kid, private_pem, public_pem FROM lab02.keys WHERE id = 1`).Scan(&kid, &priv, &pub); err != nil {
		return err
	}
	if s.keys, err = parseKeys(kid, priv, pub); err != nil {
		return err
	}

	phc, err := hashPassword(seedPassword)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `INSERT INTO lab02.users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`, seedEmail, phc)
	return err
}

// FindUser returns found=false (and no error) for an unknown email.
func (s *Store) FindUser(ctx context.Context, email string) (id, phc string, found bool, err error) {
	err = s.db.QueryRow(ctx, `SELECT id::text, password_hash FROM lab02.users WHERE email = $1`, email).Scan(&id, &phc)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", false, nil
	}
	return id, phc, err == nil, err
}
