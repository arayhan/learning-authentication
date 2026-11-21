// Lab 02 contract: runs against ONE live implementation (LAB_BASE_URL) via scripts/contract.mjs.
// Set OTHER_URL to the other implementation to also run the cross-impl interop tests.
// Every defense test has a vulnerable-mode (or hand-signed) counterpart, so each defense is proven to be the thing that blocks the attack.
import { createHash, createHmac, createPrivateKey, createPublicKey, createSign, createVerify, generateKeyPairSync, type KeyObject } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const IMPL = process.env.LAB_IMPL ?? "go";
const BASE = process.env.LAB_BASE_URL ?? `http://127.0.0.1:${IMPL === "go" ? 4102 : 4202}`;
const OTHER = process.env.OTHER_URL;
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://academy:academy@localhost:5433/labs";
const sql = postgres(DATABASE_URL, { onnotice: () => {} });
afterAll(() => sql.end());
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const ISS = "http://localhost:4102";
const AUD = "lab02-api";
const ALICE = { email: "alice@example.com", password: "correct-horse-battery" };
const VULN = { "X-Lab-Mode": "vulnerable" };

type Res = { status: number; text: string; json: any; headers: Headers; setCookies: string[]; rt?: string };

async function call(
  path: string,
  o: { base?: string; method?: string; body?: unknown; raw?: string; rt?: string; bearer?: string; headers?: Record<string, string> } = {},
): Promise<Res> {
  const headers: Record<string, string> = { ...o.headers };
  if (o.body !== undefined || o.raw !== undefined) headers["Content-Type"] = "application/json";
  if (o.rt !== undefined) headers.Cookie = `rt=${o.rt}`;
  if (o.bearer !== undefined) headers.Authorization = `Bearer ${o.bearer}`;
  const res = await fetch((o.base ?? BASE) + path, {
    method: o.method ?? (o.body !== undefined || o.raw !== undefined ? "POST" : "GET"),
    headers,
    body: o.raw ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
    redirect: "manual",
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { /* not json */ }
  const setCookies = res.headers.getSetCookie();
  const rt = setCookies.find((c) => c.startsWith("rt="))?.split(";")[0]!.slice(3);
  return { status: res.status, text, json, headers: res.headers, setCookies, rt };
}

const login = async (base?: string) => {
  const r = await call("/login", { base, body: ALICE });
  expect(r.status).toBe(200);
  return { res: r, access: r.json.access_token as string, rt: r.rt! };
};
const profile = (token: string, vuln = false) => call("/api/profile", { bearer: token, headers: vuln ? VULN : {} });
const refresh = (rt: string, base?: string) => call("/refresh", { base, method: "POST", rt });

const b64 = (v: unknown) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());
const header = (jwt: string) => decode(jwt.split(".")[0]!);
const payload = (jwt: string) => decode(jwt.split(".")[1]!);

/** Hand-signed RS256 JWT (so tests can control every claim). */
function signRS256(h: object, p: object, key: KeyObject): string {
  const input = `${b64(h)}.${b64(p)}`;
  return `${input}.${createSign("RSA-SHA256").update(input).sign(key).toString("base64url")}`;
}

let kid = "";
let privateKey: KeyObject;
let publicPem = "";
let privatePem = "";
const now = () => Math.floor(Date.now() / 1000);
const goodClaims = (over: Record<string, unknown> = {}) => ({
  iss: ISS, aud: AUD, sub: "11111111-1111-4111-8111-111111111111", email: "alice@example.com", iat: now(), exp: now() + 300, jti: "t-" + Math.random(), ...over,
});
const signed = (over: Record<string, unknown> = {}, h: Record<string, unknown> = {}) =>
  signRS256({ alg: "RS256", typ: "JWT", kid, ...h }, goodClaims(over), privateKey);

beforeAll(async () => {
  const [row] = await sql`SELECT kid, private_pem, public_pem FROM lab02.keys WHERE id = 1`;
  kid = row!.kid;
  privatePem = row!.private_pem;
  publicPem = row!.public_pem;
  privateKey = createPrivateKey(privatePem);
});

describe(`lab02 contract (${IMPL} @ ${BASE})`, () => {
  test("GET /healthz → 200", async () => {
    expect((await call("/healthz")).status).toBe(200);
  });

  describe("keys and JWKS", () => {
    test("jwks has one RS256 key; kid matches the token header and derives from the SPKI hash", async () => {
      const r = await call("/.well-known/jwks.json");
      expect(r.status).toBe(200);
      expect(r.json.keys).toHaveLength(1);
      const k = r.json.keys[0];
      expect(Object.keys(k).sort()).toEqual(["alg", "e", "kid", "kty", "n", "use"]);
      expect(k).toMatchObject({ kty: "RSA", alg: "RS256", use: "sig", kid });
      const spki = createPublicKey({ key: { kty: k.kty, n: k.n, e: k.e }, format: "jwk" }).export({ type: "spki", format: "der" });
      expect(k.kid).toBe(createHash("sha256").update(spki).digest("base64url").slice(0, 16));
      expect(header((await login()).access).kid).toBe(k.kid);
    });

    test("stored PEMs are PKCS#8 / SPKI with LF endings; jwks n/e match the stored public key; RSA-2048", async () => {
      for (const [pem, label] of [[privatePem, "PRIVATE KEY"], [publicPem, "PUBLIC KEY"]] as const) {
        expect(pem.startsWith(`-----BEGIN ${label}-----\n`)).toBe(true);
        expect(pem.endsWith(`-----END ${label}-----\n`)).toBe(true);
        expect(pem).not.toContain("\r");
      }
      const k = (await call("/.well-known/jwks.json")).json.keys[0];
      const jwk = createPublicKey(publicPem).export({ format: "jwk" });
      expect({ n: k.n, e: k.e }).toEqual({ n: jwk.n, e: jwk.e });
      expect(Buffer.from(k.n, "base64url").length).toBe(256);
    });
  });

  describe("login", () => {
    test("200 {access_token, token_type, expires_in} + rt cookie, no-store", async () => {
      const { res } = await login();
      expect(Object.keys(res.json).sort()).toEqual(["access_token", "expires_in", "token_type"]);
      expect(res.json.token_type).toBe("Bearer");
      expect(res.json.expires_in).toBe(300);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const c = res.setCookies.find((x) => x.startsWith("rt="))!;
      expect(c).toMatch(/;\s*Path=\/refresh(;|$)/i);
      expect(c).toMatch(/;\s*Max-Age=1209600/i);
      expect(c).toMatch(/;\s*HttpOnly/i);
      expect(c).toMatch(/;\s*SameSite=Strict/i);
      expect(res.rt).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    test("access token: RS256 header with kid, signature verifies against the stored key, claims are as specified", async () => {
      const { access } = await login();
      const h = header(access);
      expect(h).toEqual({ alg: "RS256", typ: "JWT", kid });
      const [a, b, sig] = access.split(".");
      expect(createVerify("RSA-SHA256").update(`${a}.${b}`).verify(createPublicKey(publicPem), Buffer.from(sig!, "base64url"))).toBe(true);
      const p = payload(access);
      expect(p.iss).toBe(ISS);
      expect(p.aud).toBe(AUD);
      expect(p.sub).toMatch(/^[0-9a-f-]{36}$/);
      expect(p.email).toBe("alice@example.com");
      expect(Number.isInteger(p.iat)).toBe(true);
      expect(p.exp).toBe(p.iat + 300);
      expect(Math.abs(p.iat - now())).toBeLessThan(10);
      expect(p.jti).toBeTruthy();
      expect(p.jti).not.toBe(payload((await login()).access).jti);
    });

    test("email is trimmed and lowercased", async () => {
      expect((await call("/login", { body: { email: "  ALICE@Example.com ", password: ALICE.password } })).status).toBe(200);
    });

    test("unknown email and wrong password → same 401 and body", async () => {
      const wrong = await call("/login", { body: { email: ALICE.email, password: "wrong password!" } });
      const unknown = await call("/login", { body: { email: `nobody${Date.now()}@example.test`, password: "wrong password!" } });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.text).toBe(unknown.text);
      expect(wrong.json).toEqual({ error: "invalid credentials" });
      expect(wrong.setCookies).toEqual([]);
    });

    test("bad input → 400 invalid json / invalid email / invalid password; trailing garbage → 400; > 1 MiB → 413", async () => {
      expect((await call("/login", { raw: "{nope" })).json).toEqual({ error: "invalid json" });
      for (const raw of [`{"email":"a@b.io","password":"x"} x`, `{"email":"a@b.io","password":"x"}{}`]) {
        const r = await call("/login", { raw });
        expect(r.status).toBe(400);
        expect(r.json).toEqual({ error: "invalid json" });
      }
      expect((await call("/login", { body: { email: "no-at", password: "x" } })).json).toEqual({ error: "invalid email" });
      expect((await call("/login", { body: { email: "a@b.io" } })).json).toEqual({ error: "invalid password" });
      const big = await call("/login", { raw: JSON.stringify({ email: ALICE.email, password: "x".repeat(1_200_000) }) });
      expect(big.status).toBe(413);
      expect(big.json).toEqual({ error: "body too large" });
    });
  });

  describe("secure verifier (/api/profile)", () => {
    test("valid token → 200 {sub,email}, no-store", async () => {
      const { access } = await login();
      const r = await profile(access);
      expect(r.status).toBe(200);
      expect(r.json).toEqual({ sub: payload(access).sub, email: "alice@example.com" });
      expect(r.headers.get("cache-control")).toBe("no-store");
    });

    test("hand-signed token with the real key and good claims → 200 (so the failures below are about the claim)", async () => {
      expect((await profile(signed())).status).toBe(200);
    });

    test("no token → 401 with bare `WWW-Authenticate: Bearer`; garbage token → invalid_token", async () => {
      const none = await call("/api/profile");
      expect(none.status).toBe(401);
      expect(none.headers.get("www-authenticate")).toBe("Bearer");
      for (const bad of ["garbage", "a.b.c", ".."]) {
        const r = await call("/api/profile", { headers: { Authorization: `Bearer ${bad}` } });
        expect(r.status).toBe(401);
        expect(r.headers.get("www-authenticate")).toBe('Bearer error="invalid_token"');
      }
      expect((await call("/api/profile", { headers: { Authorization: "Basic abc" } })).headers.get("www-authenticate")).toBe("Bearer");
    });

    test("tampered payload → 401, in secure AND vulnerable mode (RS256 signature is still checked)", async () => {
      const { access } = await login();
      const [h, , s] = access.split(".");
      const forged = `${h}.${b64({ ...payload(access), email: "admin@example.com" })}.${s}`;
      for (const vuln of [false, true]) {
        const r = await profile(forged, vuln);
        expect(r.status).toBe(401);
        expect(r.headers.get("www-authenticate")).toBe('Bearer error="invalid_token"');
      }
    });

    test("token signed by a different RSA key → 401 in both modes", async () => {
      const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
      const t = signRS256({ alg: "RS256", typ: "JWT", kid }, goodClaims(), other);
      expect((await profile(t)).status).toBe(401);
      expect((await profile(t, true)).status).toBe(401);
    });

    test("alg none: secure → 401, vulnerable → 200 with the forged identity", async () => {
      const t = `${b64({ alg: "none", typ: "JWT" })}.${b64(goodClaims({ email: "root@example.com", sub: "forged" }))}.`;
      expect((await profile(t)).status).toBe(401);
      const v = await profile(t, true);
      expect(v.status).toBe(200);
      expect(v.json).toEqual({ sub: "forged", email: "root@example.com" });
      // the classic case-variant and missing-dot bypasses
      expect((await profile(t.replace(b64({ alg: "none", typ: "JWT" }), b64({ alg: "None" })), true)).status).toBe(200);
      expect((await profile(t.slice(0, -1))).status).toBe(401);
    });

    test("HS256 signed with the public PEM: secure → 401, vulnerable → 200", async () => {
      const input = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(goodClaims({ email: "root@example.com" }))}`;
      const t = `${input}.${createHmac("sha256", publicPem).update(input).digest("base64url")}`;
      expect((await profile(t)).status).toBe(401);
      const v = await profile(t, true);
      expect(v.status).toBe(200);
      expect(v.json.email).toBe("root@example.com");
      // wrong HMAC secret is rejected even by the naive verifier: it is a missing pin, not a missing check
      const bad = `${input}.${createHmac("sha256", "not the public key").update(input).digest("base64url")}`;
      expect((await profile(bad, true)).status).toBe(401);
    });

    test("expired token: secure → 401, vulnerable → 200 (naive ignores exp)", async () => {
      const t = signed({ iat: now() - 7200, exp: now() - 3600 });
      expect((await profile(t)).status).toBe(401);
      expect((await profile(t, true)).status).toBe(200);
    });

    test("wrong aud / wrong iss / missing exp: secure → 401, vulnerable → 200", async () => {
      for (const t of [
        signed({ aud: "some-other-api" }),
        signed({ iss: "http://evil.test" }),
        signed({ aud: undefined }),
        signed({ iss: undefined }),
        signed({ exp: undefined }),
      ]) {
        expect((await profile(t)).status).toBe(401);
        expect((await profile(t, true)).status).toBe(200);
      }
    });

    test("aud as an array containing lab02-api is accepted", async () => {
      expect((await profile(signed({ aud: ["other", AUD] }))).status).toBe(200);
    });
  });

  describe("refresh rotation", () => {
    test("rotates: 200 + new access token + new rt cookie, no-store; old rt reused → 401 and family revoked", async () => {
      const a = await login();
      const r1 = await refresh(a.rt);
      expect(r1.status).toBe(200);
      expect(r1.headers.get("cache-control")).toBe("no-store");
      expect(r1.json.token_type).toBe("Bearer");
      expect(r1.json.expires_in).toBe(300);
      expect((await profile(r1.json.access_token)).status).toBe(200);
      expect(r1.rt).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(r1.rt).not.toBe(a.rt);
      expect(r1.setCookies.find((c) => c.startsWith("rt="))).toMatch(/Path=\/refresh.*Max-Age=1209600.*HttpOnly.*SameSite=Strict/i);

      const reuse = await refresh(a.rt); // attacker replays the stolen, already-rotated token
      expect(reuse.status).toBe(401);
      expect(reuse.json).toEqual({ error: "invalid refresh token" });
      expect((await refresh(r1.rt!)).status).toBe(401); // the legit new token died with the family
    });

    test("chained rotations work (rt1 → rt2 → rt3) and the family is shared", async () => {
      const a = await login();
      const r1 = await refresh(a.rt);
      const r2 = await refresh(r1.rt!);
      expect(r2.status).toBe(200);
      const rows = await sql`SELECT family_id::text FROM lab02.refresh_tokens WHERE id IN ${sql([sha256(a.rt), sha256(r1.rt!), sha256(r2.rt!)])}`;
      expect(new Set(rows.map((r) => r.family_id)).size).toBe(1);
      expect(rows).toHaveLength(3);
    });

    test("families are independent: reuse in one family does not touch another login", async () => {
      const a = await login();
      const b = await login();
      await refresh(a.rt);
      expect((await refresh(a.rt)).status).toBe(401);
      expect((await refresh(b.rt)).status).toBe(200);
    });

    test("missing / unknown / garbage rt → 401", async () => {
      expect((await call("/refresh", { method: "POST" })).status).toBe(401);
      expect((await refresh("nope")).status).toBe(401);
      expect((await refresh("A".repeat(43))).status).toBe(401);
    });

    test("expired refresh token (expires_at in the past) → 401", async () => {
      const a = await login();
      await sql`UPDATE lab02.refresh_tokens SET expires_at = now() - interval '1 minute' WHERE id = ${sha256(a.rt)}`;
      expect((await refresh(a.rt)).status).toBe(401);
    });

    test("concurrent double refresh of the same token: at most one 200", async () => {
      const a = await login();
      const rs = await Promise.all(Array.from({ length: 6 }, () => refresh(a.rt)));
      const ok = rs.filter((r) => r.status === 200).length;
      expect(ok).toBeLessThanOrEqual(1);
      expect(rs.every((r) => r.status === 200 || r.status === 401)).toBe(true);
      const newest = rs.find((r) => r.status === 200)?.rt;
      if (newest) expect((await refresh(newest)).status).toBe(401); // the losers revoked the family
    });
  });

  describe("logout", () => {
    test("POST /refresh/logout → 204, clears the cookie; refresh afterwards → 401", async () => {
      const a = await login();
      const out = await call("/refresh/logout", { method: "POST", rt: a.rt });
      expect(out.status).toBe(204);
      const c = out.setCookies.find((x) => x.startsWith("rt="))!;
      expect(c).toMatch(/^rt=;/);
      expect(c).toMatch(/Path=\/refresh/i);
      expect(c).toMatch(/Max-Age=0/i);
      expect((await refresh(a.rt)).status).toBe(401);
    });

    test("logout revokes the whole family, including already-rotated successors", async () => {
      const a = await login();
      const r1 = await refresh(a.rt);
      expect((await call("/refresh/logout", { method: "POST", rt: r1.rt })).status).toBe(204);
      expect((await refresh(r1.rt!)).status).toBe(401);
      const rows = await sql`SELECT revoked_at FROM lab02.refresh_tokens WHERE id IN ${sql([sha256(a.rt), sha256(r1.rt!)])}`;
      expect(rows.every((r) => r.revoked_at !== null)).toBe(true);
    });

    test("logout without or with an unknown cookie is still 204 and clears", async () => {
      for (const rt of [undefined, "nope"]) {
        const out = await call("/refresh/logout", { method: "POST", rt });
        expect(out.status).toBe(204);
        expect(out.setCookies.find((x) => x.startsWith("rt="))).toMatch(/Max-Age=0/i);
      }
    });
  });

  describe("storage", () => {
    test("refresh_tokens holds sha256(rt), never the raw value; reuse sets revoked_at on every row of the family", async () => {
      const a = await login();
      expect(await sql`SELECT 1 FROM lab02.refresh_tokens WHERE id = ${a.rt}`).toHaveLength(0);
      const [row] = await sql`SELECT used_at, revoked_at, expires_at > now() + interval '13 days' AS long FROM lab02.refresh_tokens WHERE id = ${sha256(a.rt)}`;
      expect(row).toMatchObject({ used_at: null, revoked_at: null, long: true });
      const r1 = await refresh(a.rt);
      const [old] = await sql`SELECT used_at FROM lab02.refresh_tokens WHERE id = ${sha256(a.rt)}`;
      expect(old!.used_at).not.toBeNull();
      await refresh(a.rt); // reuse
      const rows = await sql`SELECT revoked_at FROM lab02.refresh_tokens WHERE id IN ${sql([sha256(a.rt), sha256(r1.rt!)])}`;
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.revoked_at !== null)).toBe(true);
    });
  });

  describe("attack helper /__attack/sign", () => {
    const sign = (body: unknown, vuln = true) => call("/__attack/sign", { body, headers: vuln ? VULN : {} });

    test("404 without the vulnerable header", async () => {
      expect((await sign({ mode: "none" }, false)).status).toBe(404);
    });

    test("bad mode / bad shape → 400", async () => {
      expect((await sign({ mode: "rot13" })).status).toBe(400);
      expect((await sign({})).status).toBe(400);
      expect((await sign({ mode: "none", payload: "x" })).status).toBe(400);
      expect((await call("/__attack/sign", { raw: "{nope", headers: VULN })).status).toBe(400);
    });

    test("none: unsigned (empty signature), claims defaulted; secure 401, vulnerable 200", async () => {
      const r = await sign({ mode: "none", payload: { sub: "evil", email: "evil@example.test" } });
      expect(r.status).toBe(200);
      const t: string = r.json.token;
      expect(t.endsWith(".")).toBe(true);
      expect(t.split(".")).toHaveLength(3);
      expect(header(t).alg).toBe("none");
      expect(payload(t)).toMatchObject({ iss: ISS, aud: AUD, sub: "evil", email: "evil@example.test" });
      expect(payload(t).exp).toBe(payload(t).iat + 300);
      expect(payload(t).jti).toBeTruthy();
      expect((await profile(t)).status).toBe(401);
      expect((await profile(t, true)).json).toEqual({ sub: "evil", email: "evil@example.test" });
    });

    test("hs256-with-public-key: signature is HMAC-SHA256 keyed with the stored public_pem string", async () => {
      const t: string = (await sign({ mode: "hs256-with-public-key", payload: { email: "evil@example.test" } })).json.token;
      expect(header(t)).toMatchObject({ alg: "HS256" });
      const [h, p, s] = t.split(".");
      expect(s).toBe(createHmac("sha256", publicPem).update(`${h}.${p}`).digest("base64url"));
      expect((await profile(t)).status).toBe(401);
      expect((await profile(t, true)).status).toBe(200);
    });

    test("expired: genuinely RS256-signed with the real key, exp in the past; secure 401, vulnerable 200", async () => {
      const t: string = (await sign({ mode: "expired" })).json.token;
      expect(header(t)).toMatchObject({ alg: "RS256", kid });
      expect(payload(t).exp).toBeLessThan(now());
      const [h, p, s] = t.split(".");
      expect(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(createPublicKey(publicPem), Buffer.from(s!, "base64url"))).toBe(true);
      expect((await profile(t)).status).toBe(401);
      expect((await profile(t, true)).status).toBe(200);
    });
  });

  describe("CORS", () => {
    test("preflight from the academy origin → 204 with credentials headers", async () => {
      const r = await call("/login", { method: "OPTIONS", headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" } });
      expect(r.status).toBe(204);
      expect(r.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
      expect(r.headers.get("access-control-allow-credentials")).toBe("true");
      expect(r.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
      expect(r.headers.get("access-control-allow-headers")).toBe("Content-Type, Authorization, X-CSRF-Token, X-Lab-Mode");
      expect(r.headers.get("vary")).toMatch(/Origin/i);
    });
    test("other origins get no allow-origin", async () => {
      expect((await call("/healthz", { headers: { Origin: "http://evil.test" } })).headers.get("access-control-allow-origin")).toBeNull();
    });
    test("actual responses echo the allowed origin and expose headers", async () => {
      const r = await call("/healthz", { headers: { Origin: "http://localhost:3000" } });
      expect(r.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
      expect(r.headers.get("access-control-expose-headers")).toBe("Retry-After, WWW-Authenticate, Location");
    });
  });

  describe("trace", () => {
    test("GET /__trace streams lab 02 events; passwords and nothing else secret leak", async () => {
      const marker = "S3cret-marker-" + Math.random().toString(36).slice(2);
      await call("/login", { body: { email: ALICE.email, password: marker } });
      const ctl = new AbortController();
      const res = await fetch(`${BASE}/__trace`, { signal: ctl.signal });
      expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let seen = "";
      const t = Date.now();
      while (!seen.includes("/login") && Date.now() - t < 3000) {
        const { value, done } = await reader.read();
        if (done) break;
        seen += dec.decode(value);
      }
      ctl.abort();
      expect(seen).toContain('"lab":"02"');
      expect(seen).toContain(`"impl":"${IMPL}"`);
      expect(seen).toContain("/login");
      expect(seen).not.toContain(marker);
    });
  });

  describe("interop (Review Focus #5)", () => {
    let otherUp = false;
    beforeAll(async () => {
      if (!OTHER) return;
      try {
        otherUp = (await fetch(`${OTHER}/healthz`, { signal: AbortSignal.timeout(1500) })).ok;
      } catch { /* unreachable */ }
    });
    const needOther = (ctx: { skip: (note?: string) => never }) => {
      if (!otherUp) ctx.skip(OTHER ? `OTHER_URL ${OTHER} unreachable` : "OTHER_URL not set");
    };

    test("interop: token from other impl verifies here (secure verifier, same kid, same iss)", async (ctx) => {
      needOther(ctx);
      const { access } = await login(OTHER);
      expect(header(access).kid).toBe(kid);
      expect(payload(access).iss).toBe(ISS);
      const r = await profile(access);
      expect(r.status).toBe(200);
      expect(r.json.email).toBe("alice@example.com");
    });

    test("interop: both impls publish the same JWKS", async (ctx) => {
      needOther(ctx);
      expect((await call("/.well-known/jwks.json", { base: OTHER })).json).toEqual((await call("/.well-known/jwks.json")).json);
    });

    test("interop: refresh token issued by the other impl rotates here; reuse is still caught", async (ctx) => {
      needOther(ctx);
      const a = await login(OTHER);
      const r1 = await refresh(a.rt);
      expect(r1.status).toBe(200);
      expect((await profile(r1.json.access_token)).status).toBe(200);
      expect((await refresh(a.rt, OTHER)).status).toBe(401); // reuse seen by the OTHER impl, family dies for both
      expect((await refresh(r1.rt!)).status).toBe(401);
    });

    test("interop: attack tokens forged by the other impl behave the same here", async (ctx) => {
      needOther(ctx);
      for (const mode of ["none", "hs256-with-public-key", "expired"]) {
        const t = (await call("/__attack/sign", { base: OTHER, body: { mode }, headers: VULN })).json.token;
        expect((await profile(t)).status).toBe(401);
        expect((await profile(t, true)).status).toBe(200);
      }
    });
  });
});
