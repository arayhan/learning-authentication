import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "./store.ts";

// Refresh tokens are opaque (not JWTs): the server must be able to revoke them, so it keeps state.
// Only sha256(token) is stored. Tokens form a FAMILY per login; each refresh retires the presented token
// (used_at) and issues a successor in the same family. A retired token coming back means it was copied:
// the whole family is revoked, so the thief AND the victim must log in again.
export const REFRESH_MAX_AGE = 14 * 24 * 3600; // seconds; expires_at uses the same 14 days

/** 32 random bytes, base64url without padding. */
export const newToken = () => randomBytes(32).toString("base64url");

/** What the DB stores: a stolen DB dump must not contain usable refresh tokens. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Path=/refresh: the browser sends the cookie ONLY to /refresh and /refresh/logout, never with API calls.
// SameSite=Strict: never sent on cross-site requests. No Secure because the labs run on plain http://localhost;
// in production Secure is REQUIRED.
export const refreshCookie = (token: string) => `rt=${token}; Path=/refresh; Max-Age=${REFRESH_MAX_AGE}; HttpOnly; SameSite=Strict`;
export const clearRefreshCookie = () => "rt=; Path=/refresh; Max-Age=0; HttpOnly; SameSite=Strict";

/** Starts a refresh-token family for a fresh login. */
export async function newFamily(sql: Sql, userId: string): Promise<string> {
  const token = newToken();
  await sql`INSERT INTO lab02.refresh_tokens (id, family_id, user_id, expires_at)
VALUES (${hashToken(token)}, gen_random_uuid(), ${userId}::uuid, now() + interval '14 days')`;
  return token;
}

/**
 * Retires the presented token and issues its successor, atomically. The presented row is locked (FOR UPDATE),
 * so two concurrent refreshes of the same token cannot both succeed: the loser re-reads the row after the
 * winner commits, sees used_at, and takes the reuse path.
 * undefined means 401 (unknown, expired, reused or revoked). A reused or revoked token also revokes its family.
 */
export function rotate(sql: Sql, token: string): Promise<{ userId: string; email: string; next: string } | undefined> {
  return sql.begin(async (tx) => {
    const [r] = await tx<{ family: string; userId: string; email: string; used: boolean; revoked: boolean; expired: boolean }[]>`
SELECT r.family_id::text AS family, r.user_id::text AS "userId", u.email, r.used_at IS NOT NULL AS used,
       r.revoked_at IS NOT NULL AS revoked, r.expires_at <= now() AS expired
FROM lab02.refresh_tokens r JOIN lab02.users u ON u.id = r.user_id
WHERE r.id = ${hashToken(token)} FOR UPDATE OF r`;
    if (!r) return undefined;
    if (r.used || r.revoked) { // REUSE DETECTION: this token was already spent (or its family is dead)
      await tx`UPDATE lab02.refresh_tokens SET revoked_at = now() WHERE family_id = ${r.family}::uuid AND revoked_at IS NULL`;
      return undefined; // returning (not throwing) commits: the revocation must stick even though the request fails
    }
    if (r.expired) return undefined;
    const next = newToken();
    await tx`UPDATE lab02.refresh_tokens SET used_at = now() WHERE id = ${hashToken(token)}`;
    await tx`INSERT INTO lab02.refresh_tokens (id, family_id, user_id, expires_at)
VALUES (${hashToken(next)}, ${r.family}::uuid, ${r.userId}::uuid, now() + interval '14 days')`;
    return { userId: r.userId, email: r.email, next };
  });
}

/** Kills every token in the family of the presented one (used or not). Unknown tokens are a no-op. */
export async function revokeFamily(sql: Sql, token: string): Promise<void> {
  await sql`UPDATE lab02.refresh_tokens SET revoked_at = now()
WHERE revoked_at IS NULL AND family_id = (SELECT family_id FROM lab02.refresh_tokens WHERE id = ${hashToken(token)})`;
}
