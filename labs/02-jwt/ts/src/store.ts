import postgres from "postgres";
import { hashPassword } from "./password.ts";
import { generatePems, loadKeys, type Keys } from "./keys.ts";

// Keep this DDL byte-for-byte in sync with labs/02-jwt/go/store.go.
export const ddl = `
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
`;

const SEED_EMAIL = "alice@example.com";
const SEED_PASSWORD = "correct-horse-battery";

export type Sql = postgres.Sql;
export type Store = Awaited<ReturnType<typeof openStore>>;

/** Creates the schema, loads (or creates) the shared signing key, and seeds alice. */
export async function openStore(url: string) {
  const sql = postgres(url, { onnotice: () => {} });
  // Go and TS may start at the same moment: serialize the DDL so CREATE ... IF NOT EXISTS cannot race.
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('lab02.ddl'))`;
    await tx.unsafe(ddl); // no params: simple protocol, so multiple statements are fine
  });

  // Generate, insert-if-absent, then READ BACK: whoever inserted first wins and every process uses that row.
  const fresh = generatePems();
  await sql`INSERT INTO lab02.keys (id, kid, private_pem, public_pem) VALUES (1, ${fresh.kid}, ${fresh.privatePem}, ${fresh.publicPem}) ON CONFLICT (id) DO NOTHING`;
  const [row] = await sql<{ kid: string; private_pem: string; public_pem: string }[]>`SELECT kid, private_pem, public_pem FROM lab02.keys WHERE id = 1`;
  const keys: Keys = loadKeys(row!.kid, row!.private_pem, row!.public_pem);

  await sql`INSERT INTO lab02.users (email, password_hash) VALUES (${SEED_EMAIL}, ${await hashPassword(SEED_PASSWORD)}) ON CONFLICT (email) DO NOTHING`;

  return {
    sql,
    keys,
    /** undefined for an unknown email. */
    async findUser(email: string) {
      const [row] = await sql<{ id: string; phc: string }[]>`SELECT id::text, password_hash AS phc FROM lab02.users WHERE email = ${email}`;
      return row;
    },
  };
}
