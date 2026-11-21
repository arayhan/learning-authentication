// Lab 03 contract: runs against ONE live implementation (LAB_BASE_URL = its authorization server) via scripts/contract.mjs.
// The client SPA listener is AS port + 10 and the resource API is AS port + 20 (go 4103/4113/4123, ts 4203/4213/4223).
// Set OTHER_URL to the other implementation's AS to also run the cross-impl interop tests.
import { createHash, createPrivateKey, createSign, generateKeyPairSync, randomBytes, type KeyObject } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const IMPL = process.env.LAB_IMPL ?? "go";
const BASE = process.env.LAB_BASE_URL ?? `http://127.0.0.1:${IMPL === "go" ? 4103 : 4203}`;
const OTHER = process.env.OTHER_URL;
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://academy:academy@localhost:5433/labs";
const sql = postgres(DATABASE_URL, { onnotice: () => {} });
afterAll(() => sql.end());

const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");
const s256 = (v: string) => createHash("sha256").update(v).digest("base64url");
const at = (base: string, offset: number) => {
  const u = new URL(base);
  return `${u.protocol}//${u.hostname}:${Number(u.port) + offset}`;
};
const API = at(BASE, 20);
const CLIENT = at(BASE, 10);

const ISS = "http://localhost:4103";
const AUD = "lab03-api";
const ALICE = { email: "alice@example.com", password: "correct-horse-battery" };
const REDIR = "http://localhost:4113/callback";
const VULN = { "X-Lab-Mode": "vulnerable" };
const basic = (id: string, secret: string) => "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");

type Res = { status: number; text: string; json: any; headers: Headers; setCookies: string[]; location?: string };

async function call(
  url: string,
  o: { method?: string; form?: Record<string, string>; json?: unknown; raw?: string; ct?: string; bearer?: string; headers?: Record<string, string>; cookie?: string } = {},
): Promise<Res> {
  const headers: Record<string, string> = { ...o.headers };
  if (o.bearer !== undefined) headers.Authorization = `Bearer ${o.bearer}`;
  if (o.cookie) headers.Cookie = o.cookie;
  let body: string | undefined;
  if (o.form) {
    body = new URLSearchParams(o.form).toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (o.json !== undefined) {
    body = JSON.stringify(o.json);
    headers["Content-Type"] = "application/json";
  } else if (o.raw !== undefined) {
    body = o.raw;
    headers["Content-Type"] = o.ct ?? "application/x-www-form-urlencoded";
  }
  const res = await fetch(url, { method: o.method ?? (body !== undefined ? "POST" : "GET"), headers, body, redirect: "manual" });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, json, headers: res.headers, setCookies: res.headers.getSetCookie(), location: res.headers.get("location") ?? undefined };
}

/** A browser with a manual cookie jar for ONE authorization server. */
class Browser {
  jar = new Map<string, string>();
  constructor(public base = BASE) {}
  async req(path: string, o: Parameters<typeof call>[1] = {}) {
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const r = await call(this.base + path, { ...o, cookie: cookie || undefined });
    for (const c of r.setCookies) {
      const [kv] = c.split(";");
      const i = kv!.indexOf("=");
      const name = kv!.slice(0, i);
      const value = kv!.slice(i + 1);
      if (value === "" || /;\s*Max-Age=0/i.test(c)) this.jar.delete(name);
      else this.jar.set(name, value);
    }
    return r;
  }
}

const hidden = (html: string, name: string) => new RegExp(`name="${name}" value="([^"]*)"`).exec(html)?.[1] ?? "";
const pkcePair = () => {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: s256(verifier) };
};
const authz = (p: Record<string, string | undefined>) =>
  "/authorize?" + new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined) as [string, string][]).toString();
const goodParams = (challenge: string | undefined, over: Record<string, string | undefined> = {}) => ({
  response_type: "code", client_id: "demo-spa", redirect_uri: REDIR, scope: "photos.read profile", state: "st-" + randomBytes(6).toString("hex"),
  ...(challenge ? { code_challenge: challenge, code_challenge_method: "S256" } : {}), ...over,
});

let aliceBrowser: Browser | undefined;
/** Logs in once (through a real authorize → login round trip) and then reuses the AS session cookie. */
async function loggedIn(): Promise<Browser> {
  if (aliceBrowser) return aliceBrowser;
  const b = new Browser();
  const page = await b.req(authz(goodParams(pkcePair().challenge)));
  const r = await b.req("/login", { form: { rid: hidden(page.text, "rid"), ...ALICE } });
  expect(r.status).toBe(200);
  expect(b.jar.has("as_sid")).toBe(true);
  return (aliceBrowser = b);
}

type Redirect = { status: number; url?: URL; code?: string; error?: string; state?: string; res: Res };
const parseRedirect = (res: Res): Redirect => {
  const url = res.location ? new URL(res.location) : undefined;
  return { status: res.status, url, code: url?.searchParams.get("code") ?? undefined, error: url?.searchParams.get("error") ?? undefined, state: url?.searchParams.get("state") ?? undefined, res };
};

/** GET /authorize (→ consent, logging in first if needed) then POST /consent with the given decision. */
async function consent(b: Browser, params: Record<string, string | undefined>, decision: "approve" | "deny" = "approve", vuln = false): Promise<Redirect> {
  const p = vuln ? { ...params, lab_mode: "vulnerable" } : params;
  let page = await b.req(authz(p));
  if (page.text.includes('action="/login"')) page = await b.req("/login", { form: { rid: hidden(page.text, "rid"), ...ALICE } });
  expect(page.text).toContain('action="/consent"');
  return parseRedirect(await b.req("/consent", { form: { rid: hidden(page.text, "rid"), csrf: hidden(page.text, "csrf"), decision } }));
}

const tokenReq = (form: Record<string, string>, o: Parameters<typeof call>[1] = {}, base = BASE) =>
  call(base + "/token", { ...o, form });
const codeForm = (code: string, verifier?: string, over: Record<string, string> = {}) => ({
  grant_type: "authorization_code", client_id: "demo-spa", code, redirect_uri: REDIR, ...(verifier ? { code_verifier: verifier } : {}), ...over,
});

/** Full secure flow: returns the access token plus everything the flow produced. */
async function flow(scope = "photos.read profile", base = BASE) {
  const b = base === BASE ? await loggedIn() : new Browser(base);
  const pkce = pkcePair();
  const rd = await consent(b, goodParams(pkce.challenge, { scope }));
  expect(rd.code).toBeTruthy();
  const t = await tokenReq(codeForm(rd.code!, pkce.verifier), {}, base);
  expect(t.status).toBe(200);
  return { access: t.json.access_token as string, code: rd.code!, ...pkce, t };
}
const photos = (token: string, base = API) => call(base + "/api/photos", { bearer: token });

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());
const header = (jwt: string) => decode(jwt.split(".")[0]!);
const payload = (jwt: string) => decode(jwt.split(".")[1]!);
const signRS256 = (h: object, p: object, key: KeyObject) => {
  const input = `${b64(h)}.${b64(p)}`;
  return `${input}.${createSign("RSA-SHA256").update(input).sign(key).toString("base64url")}`;
};
const now = () => Math.floor(Date.now() / 1000);

let kid = "";
let privateKey: KeyObject;
const goodClaims = (over: Record<string, unknown> = {}) => ({
  iss: ISS, aud: AUD, sub: "11111111-1111-4111-8111-111111111111", client_id: "demo-spa", scope: "photos.read", iat: now(), exp: now() + 300, jti: "t-" + Math.random(), ...over,
});
const signed = (over: Record<string, unknown> = {}, h: Record<string, unknown> = {}) => signRS256({ alg: "RS256", typ: "JWT", kid, ...h }, goodClaims(over), privateKey);

beforeAll(async () => {
  const [row] = await sql`SELECT kid, private_pem FROM lab03.keys WHERE id = 1`;
  kid = row!.kid;
  privateKey = createPrivateKey(row!.private_pem);
});

describe(`lab03 contract (${IMPL} @ ${BASE})`, () => {
  test("GET /healthz → 200 on the AS", async () => {
    expect((await call(BASE + "/healthz")).status).toBe(200);
  });

  test("JWKS: one RS256 key whose kid matches issued tokens", async () => {
    const r = await call(BASE + "/.well-known/jwks.json");
    expect(r.status).toBe(200);
    expect(r.json.keys).toHaveLength(1);
    expect(r.json.keys[0]).toMatchObject({ kty: "RSA", alg: "RS256", use: "sig", kid });
    expect(header((await flow()).access).kid).toBe(kid);
  });

  describe("/authorize: client and redirect_uri are validated FIRST and never redirect on failure", () => {
    test("unknown client_id → 400 HTML page, no Location", async () => {
      const r = await call(BASE + authz(goodParams(pkcePair().challenge, { client_id: "nobody" })));
      expect(r.status).toBe(400);
      expect(r.headers.get("content-type")).toMatch(/text\/html/);
      expect(r.location).toBeUndefined();
    });

    test("the confidential client is not allowed to use /authorize", async () => {
      const r = await call(BASE + authz(goodParams(pkcePair().challenge, { client_id: "demo-backend" })));
      expect(r.status).toBe(400);
      expect(r.location).toBeUndefined();
    });

    test("redirect_uri must match EXACTLY: suffix, query, trailing slash, other host, missing → 400, no Location", async () => {
      for (const uri of [REDIR + "/evil", REDIR + "?x=1", REDIR + "/", "http://localhost:4113/", "http://evil.test/callback", "http://localhost:4113/callback#", undefined]) {
        const r = await call(BASE + authz(goodParams(pkcePair().challenge, { redirect_uri: uri })));
        expect(r.status, String(uri)).toBe(400);
        expect(r.location, String(uri)).toBeUndefined();
        expect(r.headers.get("content-type")).toMatch(/text\/html/);
      }
    });

    test("error page escapes attacker-controlled values", async () => {
      const r = await call(BASE + authz(goodParams(undefined, { client_id: "<script>alert(1)</script>" })));
      expect(r.status).toBe(400);
      expect(r.text).not.toContain("<script>alert(1)");
    });

    test("both registered SPA origins are accepted", async () => {
      for (const uri of ["http://localhost:4113/callback", "http://localhost:4213/callback"]) {
        const b = await loggedIn();
        const r = await b.req(authz(goodParams(pkcePair().challenge, { redirect_uri: uri })));
        expect(r.status).toBe(200);
      }
    });
  });

  describe("/authorize: other errors redirect to the (valid) redirect_uri with state", () => {
    const expectRedirectError = async (over: Record<string, string | undefined>, error: string, challenge: string | null = pkcePair().challenge) => {
      const p = goodParams(challenge ?? undefined, over); // null = no challenge at all (undefined would trigger the default)
      const r = parseRedirect(await call(BASE + authz(p))); // not logged in: the error comes before the login page
      expect(r.status).toBe(302);
      expect(r.url!.origin + r.url!.pathname).toBe(REDIR);
      expect(r.error).toBe(error);
      expect(r.state).toBe(p.state);
      expect(r.code).toBeUndefined();
    };
    test("response_type=token → unsupported_response_type", () => expectRedirectError({ response_type: "token" }, "unsupported_response_type"));
    test("missing code_challenge → invalid_request (PKCE required)", () => expectRedirectError({}, "invalid_request", null));
    test("code_challenge_method=plain → invalid_request (S256 only)", () => expectRedirectError({ code_challenge_method: "plain" }, "invalid_request"));
    test("code_challenge without a method → invalid_request", () => expectRedirectError({ code_challenge_method: undefined }, "invalid_request"));
    test("scope outside the allowed set → invalid_scope", () => expectRedirectError({ scope: "photos.read admin" }, "invalid_scope"));
    test("empty scope → invalid_scope", () => expectRedirectError({ scope: undefined }, "invalid_scope"));
  });

  describe("login and consent", () => {
    test("not logged in → login page with a form posting to /login; page is not cacheable or frameable", async () => {
      const r = await new Browser().req(authz(goodParams(pkcePair().challenge)));
      expect(r.status).toBe(200);
      expect(r.headers.get("content-type")).toMatch(/text\/html/);
      expect(r.text).toContain('action="/login"');
      expect(r.text).toContain('method="post"');
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(r.headers.get("x-frame-options")).toBe("DENY");
      expect(hidden(r.text, "rid")).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    });

    test("wrong password and unknown email give the same generic error, no session cookie", async () => {
      const b = new Browser();
      const page = await b.req(authz(goodParams(pkcePair().challenge)));
      const rid = hidden(page.text, "rid");
      const wrong = await b.req("/login", { form: { rid, email: ALICE.email, password: "wrong password!" } });
      const unknown = await b.req("/login", { form: { rid, email: `nobody${Date.now()}@example.test`, password: "wrong password!" } });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.text).toBe(unknown.text);
      expect(wrong.text).toContain("Invalid email or password");
      expect(wrong.setCookies).toEqual([]);
      expect(b.jar.size).toBe(0);
    });

    test("login with an unknown/expired rid → 400 error page", async () => {
      const r = await new Browser().req("/login", { form: { rid: "nope", ...ALICE } });
      expect(r.status).toBe(400);
    });

    test("successful login sets as_sid (HttpOnly, SameSite=Lax, Path=/) and shows the consent page with the scopes", async () => {
      const b = new Browser();
      const page = await b.req(authz(goodParams(pkcePair().challenge)));
      const r = await b.req("/login", { form: { rid: hidden(page.text, "rid"), ...ALICE } });
      expect(r.status).toBe(200);
      const c = r.setCookies.find((x) => x.startsWith("as_sid="))!;
      expect(c).toMatch(/;\s*HttpOnly/i);
      expect(c).toMatch(/;\s*SameSite=Lax/i);
      expect(c).toMatch(/;\s*Path=\/(;|$)/i);
      expect(r.text).toContain('action="/consent"');
      expect(r.text).toContain("photos.read");
      expect(r.text).toContain("profile");
      expect(r.text).toContain("demo-spa");
      expect(hidden(r.text, "csrf")).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(r.text).toMatch(/value="approve"/);
      expect(r.text).toMatch(/value="deny"/);
    });

    test("already logged in → /authorize goes straight to the consent page", async () => {
      const r = await (await loggedIn()).req(authz(goodParams(pkcePair().challenge)));
      expect(r.status).toBe(200);
      expect(r.text).toContain('action="/consent"');
    });

    test("approve → 302 redirect_uri?code&state; code is 43 base64url chars", async () => {
      const p = goodParams(pkcePair().challenge);
      const r = await consent(await loggedIn(), p);
      expect(r.status).toBe(302);
      expect(r.url!.origin + r.url!.pathname).toBe(REDIR);
      expect(r.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(r.state).toBe(p.state);
    });

    test("deny → 302 redirect_uri?error=access_denied&state, no code", async () => {
      const p = goodParams(pkcePair().challenge);
      const r = await consent(await loggedIn(), p, "deny");
      expect(r.status).toBe(302);
      expect(r.error).toBe("access_denied");
      expect(r.state).toBe(p.state);
      expect(r.code).toBeUndefined();
    });

    test("consent POST without csrf / wrong csrf / no session → 403", async () => {
      const b = await loggedIn();
      const page = await b.req(authz(goodParams(pkcePair().challenge)));
      const rid = hidden(page.text, "rid");
      const csrf = hidden(page.text, "csrf");
      expect((await b.req("/consent", { form: { rid, decision: "approve" } })).status).toBe(403);
      expect((await b.req("/consent", { form: { rid, csrf: "x".repeat(43), decision: "approve" } })).status).toBe(403);
      expect((await new Browser().req("/consent", { form: { rid, csrf, decision: "approve" } })).status).toBe(403); // attacker form, victim's rid, no cookie
      const ok = await b.req("/consent", { form: { rid, csrf, decision: "approve" } }); // the rid survived the failed attempts
      expect(ok.status).toBe(302);
    });

    test("another logged-in session cannot use someone else's rid", async () => {
      const a = await loggedIn();
      const page = await a.req(authz(goodParams(pkcePair().challenge)));
      const other = new Browser();
      const p2 = await other.req(authz(goodParams(pkcePair().challenge)));
      const login2 = await other.req("/login", { form: { rid: hidden(p2.text, "rid"), ...ALICE } });
      const r = await other.req("/consent", { form: { rid: hidden(page.text, "rid"), csrf: hidden(login2.text, "csrf"), decision: "approve" } });
      expect(r.status).toBe(400);
    });

    test("pending request is single use: replaying the consent POST → 400", async () => {
      const b = await loggedIn();
      const page = await b.req(authz(goodParams(pkcePair().challenge)));
      const form = { rid: hidden(page.text, "rid"), csrf: hidden(page.text, "csrf"), decision: "approve" };
      expect((await b.req("/consent", { form })).status).toBe(302);
      expect((await b.req("/consent", { form })).status).toBe(400);
    });

    test("the consent form does not carry client/redirect/challenge hidden fields (server-side pending request)", async () => {
      const page = await (await loggedIn()).req(authz(goodParams(pkcePair().challenge)));
      for (const n of ["client_id", "redirect_uri", "code_challenge", "scope", "state"]) expect(page.text).not.toContain(`name="${n}"`);
    });

    test("consent decisions other than approve/deny → 400", async () => {
      const b = await loggedIn();
      const page = await b.req(authz(goodParams(pkcePair().challenge)));
      const r = await b.req("/consent", { form: { rid: hidden(page.text, "rid"), csrf: hidden(page.text, "csrf"), decision: "maybe" } });
      expect(r.status).toBe(400);
    });
  });

  describe("authorization code storage", () => {
    test("DB stores sha256(code), never the raw code; bound to client, redirect_uri, challenge, scope; 60s life", async () => {
      const pkce = pkcePair();
      const rd = await consent(await loggedIn(), goodParams(pkce.challenge, { scope: "profile" }));
      const raw = await sql`SELECT 1 FROM lab03.auth_codes WHERE code_hash = ${rd.code!}`;
      expect(raw).toHaveLength(0);
      const [row] = await sql`SELECT client_id, redirect_uri, code_challenge, scope, user_id::text AS user_id, used_at, EXTRACT(EPOCH FROM expires_at - now()) AS ttl
        FROM lab03.auth_codes WHERE code_hash = ${sha256hex(rd.code!)}`;
      expect(row).toMatchObject({ client_id: "demo-spa", redirect_uri: REDIR, code_challenge: pkce.challenge, scope: "profile", used_at: null });
      expect(row!.user_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(Number(row!.ttl)).toBeGreaterThan(40);
      expect(Number(row!.ttl)).toBeLessThanOrEqual(60);
    });
  });

  describe("/token authorization_code", () => {
    test("full code + PKCE flow returns a token; /api/photos → 200", async () => {
      const f = await flow();
      expect(Object.keys(f.t.json)).toEqual(["access_token", "token_type", "expires_in", "scope"]);
      expect(f.t.json).toMatchObject({ token_type: "Bearer", expires_in: 300, scope: "photos.read profile" });
      expect(f.t.headers.get("cache-control")).toBe("no-store");
      expect(f.t.headers.get("pragma")).toBe("no-cache");
      expect(f.t.headers.get("content-type")).toMatch(/application\/json/);
      const r = await photos(f.access);
      expect(r.status).toBe(200);
      expect(r.json.photos.length).toBeGreaterThan(0);
      expect(r.headers.get("cache-control")).toBe("no-store");
    });

    test("access token: RS256+kid, signature verifies via JWKS key, claims as specified", async () => {
      const { access } = await flow();
      expect(header(access)).toEqual({ alg: "RS256", typ: "JWT", kid });
      const p = payload(access);
      expect(p).toMatchObject({ iss: ISS, aud: AUD, client_id: "demo-spa", scope: "photos.read profile" });
      expect(p.sub).toMatch(/^[0-9a-f-]{36}$/);
      expect(p.exp).toBe(p.iat + 300);
      expect(Math.abs(p.iat - now())).toBeLessThan(10);
      expect(p.jti).toBeTruthy();
      const [row] = await sql`SELECT code_hash, revoked_at FROM lab03.access_tokens WHERE jti = ${p.jti}`;
      expect(row).toBeTruthy();
      expect(row!.revoked_at).toBeNull();
    });

    test("wrong code_verifier → 400 invalid_grant, and the right one still works afterwards (PKCE defeats the thief, not the user)", async () => {
      const b = await loggedIn();
      const pkce = pkcePair();
      const rd = await consent(b, goodParams(pkce.challenge));
      const bad = await tokenReq(codeForm(rd.code!, pkcePair().verifier));
      expect(bad.status).toBe(400);
      expect(bad.json).toEqual({ error: "invalid_grant" });
      expect(bad.headers.get("cache-control")).toBe("no-store");
      expect((await tokenReq(codeForm(rd.code!, pkce.verifier))).status).toBe(200);
    });

    test("missing verifier, too-short verifier, bad characters on a challenged code → invalid_grant", async () => {
      const b = await loggedIn();
      for (const v of [undefined, "short", "a".repeat(129), "!".repeat(43)]) {
        const pkce = pkcePair();
        const rd = await consent(b, goodParams(pkce.challenge));
        const r = await tokenReq(codeForm(rd.code!, v));
        expect(r.status, String(v)).toBe(400);
        expect(r.json).toEqual({ error: "invalid_grant" });
      }
    });

    test("plain method is never honoured: verifier == challenge does not redeem", async () => {
      const b = await loggedIn();
      const pkce = pkcePair();
      const rd = await consent(b, goodParams(pkce.challenge));
      expect((await tokenReq(codeForm(rd.code!, pkce.challenge))).status).toBe(400);
    });

    test("code reused → 400 invalid_grant AND the token issued from it is revoked (API → 401)", async () => {
      const f = await flow();
      expect((await photos(f.access)).status).toBe(200);
      const again = await tokenReq(codeForm(f.code, f.verifier));
      expect(again.status).toBe(400);
      expect(again.json).toEqual({ error: "invalid_grant" });
      const r = await photos(f.access);
      expect(r.status).toBe(401);
      expect(r.headers.get("www-authenticate")).toBe('Bearer error="invalid_token"');
      const [row] = await sql`SELECT revoked_at FROM lab03.access_tokens WHERE jti = ${payload(f.access).jti}`;
      expect(row!.revoked_at).not.toBeNull();
    });

    test("concurrent redemption of one code: exactly one 200", async () => {
      const b = await loggedIn();
      const pkce = pkcePair();
      const rd = await consent(b, goodParams(pkce.challenge));
      const rs = await Promise.all(Array.from({ length: 6 }, () => tokenReq(codeForm(rd.code!, pkce.verifier))));
      expect(rs.filter((r) => r.status === 200).length).toBe(1);
      expect(rs.every((r) => r.status === 200 || r.json?.error === "invalid_grant")).toBe(true);
    });

    test("expired code → invalid_grant", async () => {
      const pkce = pkcePair();
      const rd = await consent(await loggedIn(), goodParams(pkce.challenge));
      await sql`UPDATE lab03.auth_codes SET expires_at = now() - interval '1 second' WHERE code_hash = ${sha256hex(rd.code!)}`;
      const r = await tokenReq(codeForm(rd.code!, pkce.verifier));
      expect(r.status).toBe(400);
      expect(r.json).toEqual({ error: "invalid_grant" });
    });

    test("unknown code, other redirect_uri, other client → invalid_grant / invalid_client", async () => {
      const pkce = pkcePair();
      const rd = await consent(await loggedIn(), goodParams(pkce.challenge));
      expect((await tokenReq(codeForm("A".repeat(43), pkce.verifier))).json).toEqual({ error: "invalid_grant" });
      expect((await tokenReq(codeForm(rd.code!, pkce.verifier, { redirect_uri: "http://localhost:4213/callback" }))).json).toEqual({ error: "invalid_grant" });
      const unknown = await tokenReq(codeForm(rd.code!, pkce.verifier, { client_id: "nobody" }));
      expect(unknown.status).toBe(401);
      expect(unknown.json).toEqual({ error: "invalid_client" });
      expect((await tokenReq(codeForm(rd.code!, pkce.verifier))).status).toBe(200); // none of the above burned the code
    });

    test("RFC 6749 §5.2 errors: missing grant_type / unknown grant_type / missing params / wrong content type", async () => {
      const miss = await tokenReq({});
      expect(miss.status).toBe(400);
      expect(miss.json).toEqual({ error: "invalid_request" });
      expect((await tokenReq({ grant_type: "password", username: "a", password: "b" })).json).toEqual({ error: "unsupported_grant_type" });
      expect((await tokenReq({ grant_type: "authorization_code", client_id: "demo-spa" })).json).toEqual({ error: "invalid_request" });
      expect((await tokenReq({ grant_type: "authorization_code", code: "x", redirect_uri: REDIR })).json).toEqual({ error: "invalid_request" });
      const js = await call(BASE + "/token", { json: { grant_type: "client_credentials" } });
      expect(js.status).toBe(400);
      expect(js.json).toEqual({ error: "invalid_request" });
      const dbk = await tokenReq({ grant_type: "authorization_code", client_id: "demo-backend", code: "x", redirect_uri: REDIR });
      expect(dbk.status).toBe(400);
      expect(dbk.json).toEqual({ error: "unauthorized_client" });
    });

    test("token endpoint bodies over 1 MiB → 413", async () => {
      const r = await call(BASE + "/token", { raw: "grant_type=x&pad=" + "x".repeat(1_200_000) });
      expect(r.status).toBe(413);
    });
  });

  describe("scope enforcement at the API", () => {
    test("token with scope profile only → /api/photos 403 insufficient_scope", async () => {
      const f = await flow("profile");
      expect(f.t.json.scope).toBe("profile");
      const r = await photos(f.access);
      expect(r.status).toBe(403);
      expect(r.json).toEqual({ error: "insufficient_scope" });
      expect(r.headers.get("www-authenticate")).toBe('Bearer error="insufficient_scope", scope="photos.read"');
    });
  });

  describe("client_credentials", () => {
    test("wrong secret / unknown client / no auth / public client → 401 invalid_client + WWW-Authenticate Basic", async () => {
      for (const auth of [basic("demo-backend", "nope"), basic("nobody", "lab-secret"), basic("demo-spa", "lab-secret"), basic("demo-backend", ""), undefined]) {
        const r = await tokenReq({ grant_type: "client_credentials" }, { headers: auth ? { Authorization: auth } : {} });
        expect(r.status, String(auth)).toBe(401);
        expect(r.json).toEqual({ error: "invalid_client" });
        expect(r.headers.get("www-authenticate")).toBe('Basic realm="lab03"');
      }
    });

    test("right secret → 200 token with sub demo-backend; /api/photos → 200", async () => {
      const r = await tokenReq({ grant_type: "client_credentials" }, { headers: { Authorization: basic("demo-backend", "lab-secret") } });
      expect(r.status).toBe(200);
      expect(r.json).toEqual({ access_token: r.json.access_token, token_type: "Bearer", expires_in: 300, scope: "photos.read" });
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(payload(r.json.access_token)).toMatchObject({ sub: "demo-backend", client_id: "demo-backend", scope: "photos.read", iss: ISS, aud: AUD });
      expect((await photos(r.json.access_token)).status).toBe(200);
      const [row] = await sql`SELECT code_hash FROM lab03.access_tokens WHERE jti = ${payload(r.json.access_token).jti}`;
      expect(row!.code_hash).toBeNull();
    });

    test("scope outside the client's allowed set → 400 invalid_scope; explicit photos.read is fine", async () => {
      const h = { Authorization: basic("demo-backend", "lab-secret") };
      const bad = await tokenReq({ grant_type: "client_credentials", scope: "profile" }, { headers: h });
      expect(bad.status).toBe(400);
      expect(bad.json).toEqual({ error: "invalid_scope" });
      expect((await tokenReq({ grant_type: "client_credentials", scope: "photos.read" }, { headers: h })).status).toBe(200);
    });
  });

  describe("PKCE: attack and defense (code interception)", () => {
    test("secure: authorize without PKCE is refused even if the lab_mode query is spoofed on a different path; header cannot enable it", async () => {
      const p = goodParams(undefined);
      const r = parseRedirect(await call(BASE + authz(p), { headers: VULN })); // X-Lab-Mode on /authorize means nothing
      expect(r.error).toBe("invalid_request");
    });

    test("vulnerable: no PKCE accepted; intercept succeeds, the legit client is then locked out and the stolen token dies on reuse", async () => {
      const b = await loggedIn();
      const rd = await consent(b, goodParams(undefined), "approve", true);
      expect(rd.code).toBeTruthy();
      const [row] = await sql`SELECT code_challenge FROM lab03.auth_codes WHERE code_hash = ${sha256hex(rd.code!)}`;
      expect(row!.code_challenge).toBeNull();

      const stolen = await call(BASE + "/__attack/intercept", { json: { code: rd.code }, headers: VULN });
      expect(stolen.status).toBe(200);
      expect(stolen.json).toMatchObject({ token_type: "Bearer", expires_in: 300, scope: "photos.read profile" });
      expect(stolen.headers.get("cache-control")).toBe("no-store");
      expect((await photos(stolen.json.access_token)).status).toBe(200); // the attacker is in

      const legit = await tokenReq(codeForm(rd.code!)); // the real app arrives second
      expect(legit.status).toBe(400);
      expect(legit.json).toEqual({ error: "invalid_grant" });
      expect((await photos(stolen.json.access_token)).status).toBe(401); // reuse detection revoked the stolen token
    });

    test("vulnerable code without a challenge is redeemable by anyone without a verifier (that is the vulnerability)", async () => {
      const rd = await consent(await loggedIn(), goodParams(undefined), "approve", true);
      expect((await tokenReq(codeForm(rd.code!))).status).toBe(200);
    });

    test("secure: the same intercept against a PKCE code → 400 invalid_grant, and the legit exchange still succeeds", async () => {
      const pkce = pkcePair();
      const rd = await consent(await loggedIn(), goodParams(pkce.challenge));
      const stolen = await call(BASE + "/__attack/intercept", { json: { code: rd.code }, headers: VULN });
      expect(stolen.status).toBe(400);
      expect(stolen.json).toEqual({ error: "invalid_grant" });
      expect((await tokenReq(codeForm(rd.code!, pkce.verifier))).status).toBe(200);
    });

    test("/__attack/intercept is invisible without X-Lab-Mode (404); bad bodies → 400", async () => {
      expect((await call(BASE + "/__attack/intercept", { json: { code: "x" } })).status).toBe(404);
      expect((await call(BASE + "/__attack/intercept", { json: { code: 5 }, headers: VULN })).status).toBe(400);
      expect((await call(BASE + "/__attack/intercept", { raw: "not json", ct: "application/json", headers: VULN })).status).toBe(400);
      expect((await call(BASE + "/__attack/intercept", { json: { code: "A".repeat(43) }, headers: VULN })).json).toEqual({ error: "invalid_grant" });
    });
  });

  describe("redirect_uri attack and defense", () => {
    const evil = REDIR + "/evil";
    test("vulnerable: prefix match accepted → the code is delivered to the attacker's path (secure: 400, no Location)", async () => {
      const b = await loggedIn();
      const secure = await call(BASE + authz(goodParams(undefined, { redirect_uri: evil })));
      expect(secure.status).toBe(400);
      expect(secure.location).toBeUndefined();

      const p = goodParams(undefined, { redirect_uri: evil });
      const rd = await consent(b, p, "approve", true);
      expect(rd.status).toBe(302);
      expect(rd.url!.origin + rd.url!.pathname).toBe(evil);
      expect(rd.code).toBeTruthy();
      expect(rd.state).toBe(p.state);
    });

    test("vulnerable prefix match is still a PREFIX of a registered uri: unrelated hosts stay rejected", async () => {
      const r = await call(BASE + authz(goodParams(undefined, { redirect_uri: "http://evil.test/callback", lab_mode: "vulnerable" })));
      expect(r.status).toBe(400);
      expect(r.location).toBeUndefined();
    });

    test("a code bound to the evil redirect_uri cannot be redeemed with the legit one", async () => {
      const pkce = pkcePair();
      const rd = await consent(await loggedIn(), goodParams(pkce.challenge, { redirect_uri: evil }), "approve", true);
      expect((await tokenReq(codeForm(rd.code!, pkce.verifier))).status).toBe(400);
      expect((await tokenReq(codeForm(rd.code!, pkce.verifier, { redirect_uri: evil }))).status).toBe(200);
    });
  });

  describe("resource API token validation", () => {
    test("no token → 401 bare Bearer; garbage → invalid_token; Basic scheme → bare Bearer", async () => {
      const none = await call(API + "/api/photos");
      expect(none.status).toBe(401);
      expect(none.headers.get("www-authenticate")).toBe("Bearer");
      for (const bad of ["garbage", "a.b.c", ".."]) {
        const r = await call(API + "/api/photos", { headers: { Authorization: `Bearer ${bad}` } });
        expect(r.status).toBe(401);
        expect(r.json).toEqual({ error: "invalid_token" });
        expect(r.headers.get("www-authenticate")).toBe('Bearer error="invalid_token"');
      }
      expect((await call(API + "/api/photos", { headers: { Authorization: "Basic abc" } })).headers.get("www-authenticate")).toBe("Bearer");
    });

    test("hand-signed token with the real key and good claims → 200 (so the failures below are about the claim)", async () => {
      expect((await photos(signed())).status).toBe(200);
    });

    test("wrong aud / iss, missing exp, expired, other key, alg none, HS256 → 401", async () => {
      const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
      const none = `${b64({ alg: "none", typ: "JWT" })}.${b64(goodClaims())}.`;
      for (const t of [
        signed({ aud: "lab02-api" }),
        signed({ iss: "http://evil.test" }),
        signed({ exp: undefined }),
        signed({ iat: now() - 7200, exp: now() - 3600 }),
        signRS256({ alg: "RS256", typ: "JWT", kid }, goodClaims(), other),
        signRS256({ alg: "RS256", typ: "JWT", kid: "unknown-kid" }, goodClaims(), privateKey),
        none,
      ]) {
        expect((await photos(t)).status).toBe(401);
      }
    });

    test("scope claim without photos.read → 403; scope is matched as a whole word", async () => {
      expect((await photos(signed({ scope: "profile" }))).status).toBe(403);
      expect((await photos(signed({ scope: "photos.readonly" }))).status).toBe(403);
      expect((await photos(signed({ scope: undefined }))).status).toBe(403);
      expect((await photos(signed({ scope: "profile photos.read" }))).status).toBe(200);
    });

    test("a token whose jti is revoked in the DB → 401", async () => {
      const jti = "revoked-" + Math.random();
      await sql`INSERT INTO lab03.access_tokens (jti, code_hash, revoked_at) VALUES (${jti}, NULL, now())`;
      expect((await photos(signed({ jti }))).status).toBe(401);
    });
  });

  describe("client SPA listener", () => {
    test("GET / and /callback serve the same HTML page", async () => {
      const a = await call(CLIENT + "/");
      const b = await call(CLIENT + "/callback?code=x&state=y");
      for (const r of [a, b]) {
        expect(r.status).toBe(200);
        expect(r.headers.get("content-type")).toMatch(/text\/html/);
        expect(r.text).toContain("<title>");
        expect(r.text).toContain("code_challenge");
      }
      expect(a.text).toBe(b.text);
      expect((await call(CLIENT + "/nope")).status).toBe(404);
    });
  });

  describe("CORS (AS and API)", () => {
    for (const [name, url] of [["AS", () => BASE], ["API", () => API]] as const) {
      test(`${name}: OPTIONS preflight from each allowed origin → 204 with credentials`, async () => {
        for (const origin of ["http://localhost:3000", "http://localhost:4113", "http://localhost:4213"]) {
          const r = await call(url() + "/token", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST" } });
          expect(r.status).toBe(204);
          expect(r.headers.get("access-control-allow-origin")).toBe(origin);
          expect(r.headers.get("access-control-allow-credentials")).toBe("true");
          expect(r.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
          expect(r.headers.get("access-control-allow-headers")).toBe("Content-Type, Authorization, X-Lab-Mode");
          expect(r.headers.get("vary")).toMatch(/Origin/i);
        }
      });
      test(`${name}: other origins get no allow-origin; actual responses expose WWW-Authenticate and Location`, async () => {
        expect((await call(url() + "/healthz", { headers: { Origin: "http://evil.test" } })).headers.get("access-control-allow-origin")).toBeNull();
        expect((await call(url() + "/healthz", { headers: { Origin: "http://localhost:4113/" } })).headers.get("access-control-allow-origin")).toBeNull();
        const r = await call(url() + "/healthz", { headers: { Origin: "http://localhost:4213" } });
        expect(r.headers.get("access-control-allow-origin")).toBe("http://localhost:4213");
        expect(r.headers.get("access-control-expose-headers")).toBe("WWW-Authenticate, Location");
      });
    }
  });

  describe("trace", () => {
    test("GET /__trace (AS listener only) streams lab 03 events from all three roles; passwords and client secrets are redacted", async () => {
      const marker = "S3cret-marker-" + Math.random().toString(36).slice(2);
      await new Browser().req("/login", { form: { rid: "x", email: ALICE.email, password: marker } });
      await tokenReq({ grant_type: "client_credentials", client_secret: marker });
      await call(CLIENT + "/");
      await photos("garbage");
      expect((await call(API + "/__trace")).status).toBe(404);
      expect((await call(CLIENT + "/__trace")).status).toBe(404);

      const ctl = new AbortController();
      const res = await fetch(`${BASE}/__trace`, { signal: ctl.signal });
      expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let seen = "";
      const t = Date.now();
      while (!(seen.includes('"role":"client"') && seen.includes('"role":"api"') && seen.includes('"role":"as"')) && Date.now() - t < 4000) {
        const { value, done } = await reader.read();
        if (done) break;
        seen += dec.decode(value);
      }
      ctl.abort();
      expect(seen).toContain('"lab":"03"');
      expect(seen).toContain(`"impl":"${IMPL}"`);
      for (const role of ["as", "client", "api"]) expect(seen).toContain(`"role":"${role}"`);
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

    test("interop: token issued by the other impl's AS is accepted by THIS API (shared key, same iss/aud)", async (ctx) => {
      needOther(ctx);
      const f = await flow("photos.read profile", OTHER);
      expect(header(f.access).kid).toBe(kid);
      expect(payload(f.access).iss).toBe(ISS);
      const r = await photos(f.access);
      expect(r.status).toBe(200);
      expect(r.json).toEqual((await photos(f.access, at(OTHER!, 20))).json);
    });

    test("interop: a code issued here is redeemable at the other AS (shared auth_codes), once; reuse there revokes the token for both APIs", async (ctx) => {
      needOther(ctx);
      const pkce = pkcePair();
      const rd = await consent(await loggedIn(), goodParams(pkce.challenge));
      const t = await tokenReq(codeForm(rd.code!, pkce.verifier), {}, OTHER);
      expect(t.status).toBe(200);
      expect((await photos(t.json.access_token)).status).toBe(200);
      expect((await tokenReq(codeForm(rd.code!, pkce.verifier))).status).toBe(400); // reuse seen by THIS impl
      expect((await photos(t.json.access_token)).status).toBe(401);
      expect((await photos(t.json.access_token, at(OTHER!, 20))).status).toBe(401);
    });

    test("interop: both impls publish the same JWKS and a client_credentials token from the other impl works here", async (ctx) => {
      needOther(ctx);
      expect((await call(OTHER + "/.well-known/jwks.json")).json).toEqual((await call(BASE + "/.well-known/jwks.json")).json);
      const t = await tokenReq({ grant_type: "client_credentials" }, { headers: { Authorization: basic("demo-backend", "lab-secret") } }, OTHER);
      expect((await photos(t.json.access_token)).status).toBe(200);
    });
  });
});
