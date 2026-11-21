package main

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Keep this DDL byte-for-byte in sync with labs/01-sessions/ts/src/store.ts.
const ddl = `
CREATE SCHEMA IF NOT EXISTS lab01;
CREATE TABLE IF NOT EXISTS lab01.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS lab01.sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES lab01.users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS lab01.login_failures (
  email text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_failures_email_at ON lab01.login_failures (email, at);
`

var errDuplicate = errors.New("email already registered")

type Store struct{ db *pgxpool.Pool }

func openStore(ctx context.Context, url string) (*Store, error) {
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(ctx, ddl); err != nil { // no args: simple protocol, so multiple statements are fine
		db.Close()
		return nil, err
	}
	return &Store{db}, nil
}

func (s *Store) CreateUser(ctx context.Context, email, phc string) (id string, err error) {
	err = s.db.QueryRow(ctx,
		`INSERT INTO lab01.users (email, password_hash) VALUES ($1, $2) RETURNING id::text`, email, phc).Scan(&id)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return "", errDuplicate
	}
	return id, err
}

// UserByEmail returns ok=false (and no error) when the email is unknown.
func (s *Store) UserByEmail(ctx context.Context, email string) (id, phc string, ok bool, err error) {
	err = s.db.QueryRow(ctx, `SELECT id::text, password_hash FROM lab01.users WHERE email = $1`, email).Scan(&id, &phc)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", false, nil
	}
	return id, phc, err == nil, err
}

func (s *Store) RecordFailure(ctx context.Context, email string) error {
	_, err := s.db.Exec(ctx, `INSERT INTO lab01.login_failures (email) VALUES ($1)`, email)
	return err
}

// Failures counts failures in the last 15 minutes and the seconds (>= 1) until the oldest one ages out.
// Successful logins do not clear history: shortcut, a real system would reset or decay per account.
func (s *Store) Failures(ctx context.Context, email string) (count, retryAfter int, err error) {
	err = s.db.QueryRow(ctx, `
SELECT count(*)::int,
       COALESCE(GREATEST(CEIL(EXTRACT(EPOCH FROM (min(at) + interval '15 minutes' - now()))), 1), 1)::int
FROM lab01.login_failures WHERE email = $1 AND at > now() - interval '15 minutes'`, email).Scan(&count, &retryAfter)
	return
}
