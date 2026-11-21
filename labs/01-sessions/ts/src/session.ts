import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_MAX_AGE = 3600; // seconds; the DB expires_at uses the same hour

/** 32 random bytes, base64url without padding. Used for session ids and CSRF tokens. */
export const newToken = () => randomBytes(32).toString("base64url");

/** What the DB stores: a stolen DB dump must not contain usable session cookies. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// No Secure attribute because the labs run on plain http://localhost. In production Secure is REQUIRED,
// otherwise the cookie also travels over http and can be sniffed.
export const sessionCookie = (token: string) => `sid=${token}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; SameSite=Lax`;
export const clearCookie = () => "sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax";

/** Constant-time compare (a length mismatch is rejected up front; lengths are not secret). */
export function csrfEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Session ids we accept from clients (plant-sid, and fixation in vulnerable mode).
export const SID_RE = /^[A-Za-z0-9_.~-]{1,256}$/;

/** First `sid` cookie of a Cookie header, or "". */
export function sidFromCookie(header: string | undefined): string {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === "sid") return part.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return "";
}
