import { createHmac, timingSafeEqual, verify } from "node:crypto";
import type { Keys } from "./keys.ts";

/**
 * The DELIBERATELY BROKEN verifier used in vulnerable mode. It is shown to learners.
 * Every flaw below is a real-world bug class; the secure path (verifyAccess in tokens.ts) has none of them.
 *
 *   FLAW 1: it trusts the token's own `alg` header to decide how to verify, instead of pinning the algorithm.
 *   FLAW 2: it accepts alg "none" (any capitalization): an unsigned token is "valid".
 *   FLAW 3: for HS256 it uses the server's PUBLIC key text as the HMAC secret. The public key is public, so
 *           anyone can sign (this is the RS256 -> HS256 "key confusion" attack).
 *   FLAW 4: it never looks at exp, aud or iss: expired tokens, and tokens meant for other APIs, are accepted.
 */
export function naiveVerify(token: string, k: Keys): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("malformed token"); // FLAW 2 (part): a "none" token may drop the signature segment, even its dot
  const header = decodePart(parts[0]!);
  const claims = decodePart(parts[1]!);
  const signingInput = `${parts[0]}.${parts[1]}`;
  const sig = parts[2] ?? "";

  const alg = typeof header.alg === "string" ? header.alg : ""; // FLAW 1: the attacker chose this value
  switch (alg.toLowerCase()) {
    case "none": // FLAW 2: no signature required, and whatever sits in the signature slot is ignored
      return claims;
    case "hs256": {
      const mac = createHmac("sha256", k.publicPem).update(signingInput).digest(); // FLAW 3: the public PEM string as the shared secret
      const got = b64url(sig);
      if (got.length !== mac.length || !timingSafeEqual(got, mac)) throw new Error("bad signature");
      return claims; // FLAW 4: exp / aud / iss are never checked
    }
    case "rs256":
      if (!verify("RSA-SHA256", Buffer.from(signingInput), k.publicKey, b64url(sig))) throw new Error("bad signature");
      return claims; // FLAW 4 again
  }
  throw new Error("unsupported alg");
}

// Strict base64url (Buffer.from(..., "base64url") silently skips junk, Go's decoder does not).
function b64url(s: string): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("bad base64url");
  return Buffer.from(s, "base64url");
}

function decodePart(part: string): Record<string, unknown> {
  const v: unknown = JSON.parse(b64url(part).toString("utf8"));
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("not a JSON object");
  return v as Record<string, unknown>;
}
