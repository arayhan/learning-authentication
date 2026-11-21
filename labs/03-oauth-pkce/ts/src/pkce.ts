import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// RFC 7636: a verifier is 43-128 characters of the unreserved set; an S256 challenge is the 43-char
// base64url of a SHA-256 digest.
export const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
export const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;

/** BASE64URL(SHA256(ASCII(verifier))), no padding. */
export const challengeS256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

/** Constant-time compare of two strings (digests first, so the length does not leak either). */
export const safeEqual = (a: string, b: string) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/**
 * The verifier must be well formed AND hash to the stored challenge. Only S256 exists here, so a client
 * that sends the challenge itself as the "plain" verifier simply fails.
 */
export const verifyPkce = (challenge: string, verifier: string) => VERIFIER_RE.test(verifier) && safeEqual(challengeS256(verifier), challenge);

/** 32 random bytes, base64url without padding (authorization codes, session ids, CSRF tokens, jti). */
export const newToken = () => randomBytes(32).toString("base64url");

/** What the DB stores for a code: a stolen DB dump must not contain redeemable codes. */
export const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");
