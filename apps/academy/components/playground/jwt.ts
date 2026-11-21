/** Claims and header fields the decoder explains. Wording follows RFC 7519 section 4.1 and RFC 7515 section 4.1. */
export const CLAIMS: Record<string, string> = {
  iss: "Issuer: who created and signed the token. A verifier must check it matches the issuer it trusts.",
  sub: "Subject: who the token is about, usually a stable user id.",
  aud: "Audience: which API the token is meant for. An API must reject tokens whose aud is not itself.",
  exp: "Expiration time (Unix seconds). After this moment the token must be rejected. A verifier has to require it.",
  iat: "Issued at (Unix seconds): when the token was created.",
  nbf: "Not before (Unix seconds): the token is not valid until this moment.",
  jti: "JWT ID: a unique id for this token, useful for logging or a deny list.",
  kid: "Key ID (header): which key in the issuer's JWKS signed this token.",
  alg: "Algorithm (header): how the token was signed. The verifier must pin the algorithms it accepts, never trust this value.",
  typ: "Type (header): usually JWT.",
};

type Obj = Record<string, unknown>;
export type Decoded = { ok: true; header: Obj; payload: Obj; parts: [string, string, string] } | { ok: false; error: string };

const isObject = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

function part(label: string, s: string): Obj {
  if (s === "" || !/^[A-Za-z0-9_-]+$/.test(s)) throw new Error(`the ${label} is not base64url`);
  const std = s.replaceAll("-", "+").replaceAll("_", "/");
  let json: string;
  try {
    const bin = atob(std + "=".repeat((4 - (std.length % 4)) % 4));
    json = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    throw new Error(`the ${label} is not valid base64url text`);
  }
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    throw new Error(`the ${label} is not JSON`);
  }
  if (!isObject(v)) throw new Error(`the ${label} is not a JSON object`);
  return v;
}

/** Decodes (does not verify) a compact JWS. Never throws: bad input becomes `{ ok: false, error }`. */
export function decodeJwt(input: string): Decoded {
  const token = input.trim().replace(/^bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: `Not a valid JWT: expected 3 dot-separated parts, found ${parts.length}.` };
  try {
    return { ok: true, header: part("header", parts[0]), payload: part("payload", parts[1]), parts: parts as [string, string, string] };
  } catch (e) {
    return { ok: false, error: `Not a valid JWT: ${e instanceof Error ? e.message : "could not decode it"}.` };
  }
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** "in 5 minutes" / "2 hours ago" / "just now" for a distance in seconds (positive = future). */
export function relative(deltaSec: number): string {
  const s = Math.abs(deltaSec);
  if (s < 5) return "just now";
  const text = s < 60 ? plural(Math.round(s), "second") : s < 3600 ? plural(Math.round(s / 60), "minute") : s < 86400 ? plural(Math.round(s / 3600), "hour") : plural(Math.round(s / 86400), "day");
  return deltaSec > 0 ? `in ${text}` : `${text} ago`;
}

/** A readable time line for exp / iat / nbf, or null for any other claim or a non-number. */
export function timeLabel(name: string, value: unknown, nowMs: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !["exp", "iat", "nbf"].includes(name)) return null;
  const rel = relative(value - nowMs / 1000);
  if (rel === "just now") return name === "exp" ? "expires just now" : name === "iat" ? "issued just now" : "valid from just now";
  const future = rel.startsWith("in ");
  if (name === "exp") return future ? `expires ${rel}` : `expired ${rel}`;
  if (name === "iat") return `issued ${rel}`;
  return future ? `not valid ${rel}` : `valid since ${rel}`;
}
