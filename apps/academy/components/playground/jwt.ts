/** Claims and header fields the decoder explains. Wording follows RFC 7519 section 4.1 and RFC 7515 section 4.1. */
export const CLAIMS: Record<string, string> = {
  iss: "Issuer: siapa yang membuat dan menandatangani token. Verifier wajib mengecek bahwa ini cocok dengan issuer yang dipercaya.",
  sub: "Subject: token ini tentang siapa, biasanya user id yang stabil.",
  aud: "Audience: token ini ditujukan untuk API mana. API wajib menolak token yang aud-nya bukan dirinya.",
  exp: "Expiration time (Unix seconds). Lewat dari waktu ini token wajib ditolak. Verifier harus mewajibkannya.",
  iat: "Issued at (Unix seconds): kapan token dibuat.",
  nbf: "Not before (Unix seconds): token belum valid sebelum waktu ini.",
  jti: "JWT ID: id unik untuk token ini, berguna buat logging atau deny list.",
  kid: "Key ID (header): key mana di JWKS issuer yang menandatangani token ini.",
  alg: "Algorithm (header): cara token ditandatangani. Verifier harus mengunci algoritma yang diterima, jangan pernah percaya nilai ini begitu saja.",
  typ: "Type (header): biasanya JWT.",
};

type Obj = Record<string, unknown>;
export type Decoded = { ok: true; header: Obj; payload: Obj; parts: [string, string, string] } | { ok: false; error: string };

const isObject = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

function part(label: string, s: string): Obj {
  if (s === "" || !/^[A-Za-z0-9_-]+$/.test(s)) throw new Error(`${label} bukan base64url`);
  const std = s.replaceAll("-", "+").replaceAll("_", "/");
  let json: string;
  try {
    const bin = atob(std + "=".repeat((4 - (std.length % 4)) % 4));
    json = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    throw new Error(`${label} bukan teks base64url yang valid`);
  }
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    throw new Error(`${label} bukan JSON`);
  }
  if (!isObject(v)) throw new Error(`${label} bukan JSON object`);
  return v;
}

/** Decodes (does not verify) a compact JWS. Never throws: bad input becomes `{ ok: false, error }`. */
export function decodeJwt(input: string): Decoded {
  const token = input.trim().replace(/^bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: `Bukan JWT yang valid: harusnya 3 bagian yang dipisah titik, ketemunya ${parts.length}.` };
  try {
    return { ok: true, header: part("header", parts[0]), payload: part("payload", parts[1]), parts: parts as [string, string, string] };
  } catch (e) {
    return { ok: false, error: `Bukan JWT yang valid: ${e instanceof Error ? e.message : "nggak bisa di-decode"}.` };
  }
}

/** "5 menit lagi" / "2 jam lalu" / "barusan" for a distance in seconds (positive = future). */
export function relative(deltaSec: number): string {
  const s = Math.abs(deltaSec);
  if (s < 5) return "barusan";
  const text = s < 60 ? `${Math.round(s)} detik` : s < 3600 ? `${Math.round(s / 60)} menit` : s < 86400 ? `${Math.round(s / 3600)} jam` : `${Math.round(s / 86400)} hari`;
  return deltaSec > 0 ? `${text} lagi` : `${text} lalu`;
}

/** A readable time line for exp / iat / nbf, or null for any other claim or a non-number. */
export function timeLabel(name: string, value: unknown, nowMs: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !["exp", "iat", "nbf"].includes(name)) return null;
  const delta = value - nowMs / 1000;
  const rel = relative(delta);
  if (rel === "barusan") return name === "exp" ? "kedaluwarsa barusan" : name === "iat" ? "dibuat barusan" : "valid mulai barusan";
  const future = delta > 0;
  if (name === "exp") return future ? `kedaluwarsa ${rel}` : `sudah kedaluwarsa ${rel}`;
  if (name === "iat") return `dibuat ${rel}`;
  return future ? `belum valid, ${rel}` : `valid sejak ${rel}`;
}
