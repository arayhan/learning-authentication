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

type LoginOutcome int

const (
	LoginOK LoginOutcome = iota
	LoginRejected
	LoginBlocked
)

const maxFailures = 5

// Authenticate runs rate-limit check, password verify and failure bookkeeping as ONE transaction serialized per
// email by an advisory lock. Without the lock, N parallel guesses all read "0 failures" before any failure is
// written, so the limit would not bind. verify gets found=false for an unknown email (burn dummy argon2 time there).
// Failed logins insert a row; a successful login does NOT clear history (shortcut: a real system would decay per account).
func (s *Store) Authenticate(ctx context.Context, email string, verify func(phc string, found bool) bool) (userID string, out LoginOutcome, retryAfter int, err error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", 0, 0, err
	}
	defer tx.Rollback(ctx) // no-op after Commit
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, email); err != nil {
		return
	}
	var count int
	err = tx.QueryRow(ctx, `
SELECT count(*)::int,
       COALESCE(GREATEST(CEIL(EXTRACT(EPOCH FROM (min(at) + interval '15 minutes' - now()))), 1), 1)::int
FROM lab01.login_failures WHERE email = $1 AND at > now() - interval '15 minutes'`, email).Scan(&count, &retryAfter)
	if err != nil {
		return
	}
	if count >= maxFailures {
		return "", LoginBlocked, retryAfter, nil
	}
	var phc string
	err = tx.QueryRow(ctx, `SELECT id::text, password_hash FROM lab01.users WHERE email = $1`, email).Scan(&userID, &phc)
	found := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return
	}
	if verify(phc, found) {
		return userID, LoginOK, 0, tx.Commit(ctx)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO lab01.login_failures (email) VALUES ($1)`, email); err != nil {
		return
	}
	return "", LoginRejected, 0, tx.Commit(ctx)
}
