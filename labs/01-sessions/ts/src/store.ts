import postgres from "postgres";

// Keep this DDL byte-for-byte in sync with labs/01-sessions/go/store.go.
export const ddl = `
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
`;

const MAX_FAILURES = 5;

export class DuplicateEmail extends Error {}

export type Store = Awaited<ReturnType<typeof openStore>>;

export async function openStore(url: string) {
  const sql = postgres(url, { onnotice: () => {} });
  await sql.unsafe(ddl); // no params: simple protocol, so multiple statements are fine

  return {
    async createUser(email: string, phc: string): Promise<string> {
      try {
        const [row] = await sql<{ id: string }[]>`INSERT INTO lab01.users (email, password_hash) VALUES (${email}, ${phc}) RETURNING id::text`;
        return row!.id;
      } catch (e) {
        if ((e as { code?: string }).code === "23505") throw new DuplicateEmail();
        throw e;
      }
    },

    /**
     * Rate-limit check, password verify and failure bookkeeping as ONE transaction serialized per email by an
     * advisory lock. Without the lock, N parallel guesses all read "0 failures" before any failure is written, so
     * the limit would not bind. verify gets undefined for an unknown email (burn dummy argon2 time there).
     * Failed logins insert a row; a successful login does NOT clear history (shortcut: a real system would decay per account).
     */
    authenticate(email: string, verify: (phc: string | undefined) => Promise<boolean>): Promise<
      { outcome: "ok"; userId: string } | { outcome: "rejected" } | { outcome: "blocked"; retryAfter: number }
    > {
      return sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
        const [f] = await tx<{ count: number; retryAfter: number }[]>`
SELECT count(*)::int AS count,
       COALESCE(GREATEST(CEIL(EXTRACT(EPOCH FROM (min(at) + interval '15 minutes' - now()))), 1), 1)::int AS "retryAfter"
FROM lab01.login_failures WHERE email = ${email} AND at > now() - interval '15 minutes'`;
        if (f!.count >= MAX_FAILURES) return { outcome: "blocked" as const, retryAfter: f!.retryAfter };
        const [user] = await tx<{ id: string; phc: string }[]>`SELECT id::text, password_hash AS phc FROM lab01.users WHERE email = ${email}`;
        if (await verify(user?.phc)) return { outcome: "ok" as const, userId: user!.id };
        await tx`INSERT INTO lab01.login_failures (email) VALUES (${email})`;
        return { outcome: "rejected" as const };
      });
    },

    /** Stores sha256(token). The upsert only matters in vulnerable mode, where the caller picks the token. */
    async createSession(tokenHash: string, userId: string, csrf: string) {
      await sql`
INSERT INTO lab01.sessions (id, user_id, csrf_token, expires_at) VALUES (${tokenHash}, ${userId}::uuid, ${csrf}, now() + interval '1 hour')
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, csrf_token = EXCLUDED.csrf_token, expires_at = EXCLUDED.expires_at`;
    },

    /** undefined for unknown or expired sessions. */
    async findSession(tokenHash: string) {
      const [row] = await sql<{ userId: string; email: string; csrf: string }[]>`
SELECT s.user_id::text AS "userId", u.email, s.csrf_token AS csrf FROM lab01.sessions s JOIN lab01.users u ON u.id = s.user_id
WHERE s.id = ${tokenHash} AND s.expires_at > now()`;
      return row;
    },

    async deleteSession(tokenHash: string) {
      await sql`DELETE FROM lab01.sessions WHERE id = ${tokenHash}`;
    },
  };
}
