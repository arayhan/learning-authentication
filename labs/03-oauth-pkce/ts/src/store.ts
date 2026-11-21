import postgres from "postgres";
import { generatePems, loadKeys, type Keys } from "./keys.ts";
import { hashPassword } from "./password.ts";
import { sha256hex, verifyPkce } from "./pkce.ts";

// Keep this DDL byte-for-byte in sync with labs/03-oauth-pkce/go/store.go.
export const ddl = `
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
`;

const SEED_EMAIL = "alice@example.com";
const SEED_PASSWORD = "correct-horse-battery";

export type Store = Awaited<ReturnType<typeof openStore>>;

/** Everything an authorization code is bound to. `challenge` is null only for codes issued by the vulnerable /authorize. */
export type CodeGrant = { clientId: string; redirectUri: string; scope: string; userId: string; challenge: string | null };

/** Creates the schema, loads (or creates) the shared signing key, and seeds alice. */
export async function openStore(url: string) {
  const sql = postgres(url, { onnotice: () => {} });
  // Go and TS may start at the same moment: serialize the DDL so CREATE ... IF NOT EXISTS cannot race.
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('lab03.ddl'))`;
    await tx.unsafe(ddl); // no params: simple protocol, so multiple statements are fine
  });

  // Generate, insert-if-absent, then READ BACK: whoever inserted first wins and every process uses that row.
  const fresh = generatePems();
  await sql`INSERT INTO lab03.keys (id, kid, private_pem, public_pem) VALUES (1, ${fresh.kid}, ${fresh.privatePem}, ${fresh.publicPem}) ON CONFLICT (id) DO NOTHING`;
  const [row] = await sql<{ kid: string; private_pem: string; public_pem: string }[]>`SELECT kid, private_pem, public_pem FROM lab03.keys WHERE id = 1`;
  const keys: Keys = loadKeys(row!.kid, row!.private_pem, row!.public_pem);

  await sql`INSERT INTO lab03.users (email, password_hash) VALUES (${SEED_EMAIL}, ${await hashPassword(SEED_PASSWORD)}) ON CONFLICT (email) DO NOTHING`;

  return {
    sql,
    keys,
    /** undefined for an unknown email. */
    async findUser(email: string) {
      const [row] = await sql<{ id: string; phc: string }[]>`SELECT id::text, password_hash AS phc FROM lab03.users WHERE email = ${email}`;
      return row;
    },

    /** Stores sha256(code), never the code. Codes live 60 seconds. */
    async saveCode(code: string, g: CodeGrant) {
      await sql`INSERT INTO lab03.auth_codes (code_hash, client_id, redirect_uri, code_challenge, scope, user_id, expires_at)
VALUES (${sha256hex(code)}, ${g.clientId}, ${g.redirectUri}, ${g.challenge}, ${g.scope}, ${g.userId}::uuid, now() + interval '60 seconds')`;
    },

    /** What the attacker in /__attack/intercept saw in the redirect URL (empty if the code is unknown). */
    async codeRedirectUri(code: string): Promise<string> {
      const [row] = await sql<{ redirect_uri: string }[]>`SELECT redirect_uri FROM lab03.auth_codes WHERE code_hash = ${sha256hex(code)}`;
      return row?.redirect_uri ?? "";
    },

    /**
     * Exchanges a code for an access-token record, atomically: the code row is locked (FOR UPDATE), so two
     * concurrent redemptions cannot both succeed.
     *
     * Presenting a code that was already redeemed is treated as theft: every access token issued from it is
     * revoked (RFC 6749 §4.1.2) and that revocation is COMMITTED even though the request fails. A failed PKCE
     * check, an expired code or a mismatched redirect_uri changes nothing, so a thief cannot burn the real
     * client's code.
     */
    redeem(code: string, clientId: string, redirectUri: string, verifier: string, jti: string) {
      const hash = sha256hex(code);
      return sql.begin(async (tx): Promise<{ scope: string; userId: string } | { error: "invalid_grant" }> => {
        const [g] = await tx<{ client_id: string; redirect_uri: string; code_challenge: string | null; scope: string; user_id: string; used: boolean; expired: boolean }[]>`
SELECT client_id, redirect_uri, code_challenge, scope, user_id::text AS user_id, used_at IS NOT NULL AS used, expires_at < now() AS expired
FROM lab03.auth_codes WHERE code_hash = ${hash} FOR UPDATE`;
        if (!g) return { error: "invalid_grant" };
        if (g.used) {
          await tx`UPDATE lab03.access_tokens SET revoked_at = now() WHERE code_hash = ${hash} AND revoked_at IS NULL`;
          return { error: "invalid_grant" }; // returned, not thrown: the revocation must commit
        }
        if (g.expired || g.client_id !== clientId || g.redirect_uri !== redirectUri) return { error: "invalid_grant" };
        // A code issued WITH a challenge needs the matching verifier, in every mode. A code issued without one
        // can only come from the vulnerable /authorize and is redeemable by whoever holds it.
        if (g.code_challenge !== null && !verifyPkce(g.code_challenge, verifier)) return { error: "invalid_grant" };

        await tx`UPDATE lab03.auth_codes SET used_at = now() WHERE code_hash = ${hash}`;
        await tx`INSERT INTO lab03.access_tokens (jti, code_hash) VALUES (${jti}, ${hash})`;
        return { scope: g.scope, userId: g.user_id };
      });
    },

    /** Registers a client_credentials token (no code) so it shows up in the same table. */
    async recordClientToken(jti: string) {
      await sql`INSERT INTO lab03.access_tokens (jti, code_hash) VALUES (${jti}, NULL)`;
    },

    /** A jti with no row (a token the AS never recorded) is simply not revoked. */
    async revoked(jti: string): Promise<boolean> {
      const [row] = await sql<{ revoked: boolean }[]>`SELECT revoked_at IS NOT NULL AS revoked FROM lab03.access_tokens WHERE jti = ${jti}`;
      return row?.revoked ?? false;
    },
  };
}
