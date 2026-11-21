import { createHmac, createSign } from "node:crypto";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { Keys } from "./keys.ts";
import { newToken } from "./refresh.ts";

export const ISSUER = "http://localhost:4102"; // the same string in the Go lab, whatever port that one listens on
export const AUDIENCE = "lab02-api";
export const ACCESS_TTL = 300; // seconds
const LEEWAY = 30; // seconds of clock-skew tolerance

/** Signs an RS256 access token. The kid header tells verifiers which JWKS key to use. */
export function issueAccess(k: Keys, sub: string, email: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: k.kid })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TTL)
    .setJti(newToken())
    .sign(k.privateKey);
}

/**
 * The SECURE verifier: the algorithm is pinned to RS256 (the token's own alg header is never trusted), the
 * signature must match our key, and exp (required), aud and iss are all checked.
 */
export async function verifyAccess(k: Keys, token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, k.publicKey, {
    algorithms: ["RS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
    clockTolerance: LEEWAY,
    requiredClaims: ["exp"],
  });
  return payload;
}

const b64json = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");

/**
 * Builds the attack-demo tokens behind /__attack/sign. Nothing here needs a secret: none is unsigned, the HS256
 * key is the PUBLIC key, and "expired" is a normal token whose exp is in the past. Missing claims get defaults.
 */
export function forge(k: Keys, mode: string, header: Record<string, unknown> = {}, payload: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const h: Record<string, unknown> = { typ: "JWT", ...header };
  const p: Record<string, unknown> = {
    iss: ISSUER, aud: AUDIENCE, sub: "forged-user", email: "forged@example.com", iat: now, exp: now + ACCESS_TTL, jti: newToken(), ...payload,
  };
  switch (mode) {
    case "none":
      h.alg = "none";
      return `${b64json(h)}.${b64json(p)}.`; // empty signature
    case "hs256-with-public-key": {
      h.alg = "HS256";
      h.kid ??= k.kid;
      const input = `${b64json(h)}.${b64json(p)}`;
      return `${input}.${createHmac("sha256", k.publicPem).update(input).digest("base64url")}`; // the stored public_pem string, byte for byte
    }
    case "expired": {
      h.alg = "RS256";
      h.kid ??= k.kid;
      p.iat = now - 3900; // always in the past, even if the caller sent a future exp
      p.exp = now - 3600;
      const input = `${b64json(h)}.${b64json(p)}`;
      return `${input}.${createSign("RSA-SHA256").update(input).sign(k.privateKey).toString("base64url")}`;
    }
  }
  throw new Error(`unknown mode ${mode}`);
}
