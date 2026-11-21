// Lab 01 contract: runs against ONE live implementation (LAB_BASE_URL) via scripts/contract.mjs.
// Set OTHER_URL to the other implementation to also run the cross-impl interop test.
import { beforeAll, describe, expect, test } from "vitest";

const IMPL = process.env.LAB_IMPL ?? "go";
const BASE = process.env.LAB_BASE_URL ?? `http://127.0.0.1:${IMPL === "go" ? 4101 : 4201}`;
const OTHER = process.env.OTHER_URL;
const PASSWORD = "correct horse battery";
const VULN = { "X-Lab-Mode": "vulnerable" };

type Res = { status: number; text: string; json: any; headers: Headers; setCookies: string[]; sid?: string };

async function call(
  path: string,
  o: { base?: string; method?: string; body?: unknown; raw?: string; sid?: string; csrf?: string; headers?: Record<string, string> } = {},
): Promise<Res> {
  const headers: Record<string, string> = { ...o.headers };
  if (o.body !== undefined || o.raw !== undefined) headers["Content-Type"] = "application/json";
  if (o.sid !== undefined) headers.Cookie = `sid=${o.sid}`;
  if (o.csrf !== undefined) headers["X-CSRF-Token"] = o.csrf;
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
  const sid = setCookies.find((c) => c.startsWith("sid="))?.split(";")[0]!.slice(4);
  return { status: res.status, text, json, headers: res.headers, setCookies, sid };
}

const email = () => `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}@example.test`;

async function registerAndLogin(extra: Parameters<typeof call>[1] = {}) {
  const e = email();
  expect((await call("/register", { body: { email: e, password: PASSWORD } })).status).toBe(201);
  const login = await call("/login", { body: { email: e, password: PASSWORD }, ...extra });
  expect(login.status).toBe(200);
  return { email: e, login, sid: login.sid!, csrf: login.json.csrfToken as string };
}

describe(`lab01 contract (${IMPL} @ ${BASE})`, () => {
  test("GET /healthz → 200", async () => {
    expect((await call("/healthz")).status).toBe(200);
  });

  test("GET / serves the HTML lab UI", async () => {
    const r = await call("/");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/html/);
    expect(r.text).toContain("<form");
  });

  describe("register", () => {
    test("201 {id,email}; email is trimmed and lowercased", async () => {
      const e = email();
      const r = await call("/register", { body: { email: `  ${e.toUpperCase()}  `, password: PASSWORD } });
      expect(r.status).toBe(201);
      expect(r.json.email).toBe(e);
      expect(r.json.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(r.text).not.toContain("password");
    });
    test("duplicate email (any case) → 409", async () => {
      const e = email();
      await call("/register", { body: { email: e, password: PASSWORD } });
      expect((await call("/register", { body: { email: e.toUpperCase(), password: PASSWORD } })).status).toBe(409);
    });
    test("password length outside 8–128 → 400", async () => {
      expect((await call("/register", { body: { email: email(), password: "short" } })).status).toBe(400);
      expect((await call("/register", { body: { email: email(), password: "x".repeat(129) } })).status).toBe(400);
      expect((await call("/register", { body: { email: email(), password: "x".repeat(128) } })).status).toBe(201);
    });
    test("bad email → 400", async () => {
      expect((await call("/register", { body: { email: "no-at-sign", password: PASSWORD } })).status).toBe(400);
      expect((await call("/register", { body: { email: `${"a".repeat(250)}@x.io`, password: PASSWORD } })).status).toBe(400);
    });
    test("malformed JSON → 400 invalid json", async () => {
      const r = await call("/register", { raw: "{nope" });
      expect(r.status).toBe(400);
      expect(r.json).toEqual({ error: "invalid json" });
    });
  });

  describe("login", () => {
    test("set-cookie has HttpOnly, SameSite=Lax, Path=/", async () => {
      const { login } = await registerAndLogin();
      const c = login.setCookies.find((x) => x.startsWith("sid="))!;
      expect(c).toBeDefined();
      expect(c).toMatch(/;\s*HttpOnly/i);
      expect(c).toMatch(/;\s*SameSite=Lax/i);
      expect(c).toMatch(/;\s*Path=\//i);
      expect(c).toMatch(/;\s*Max-Age=3600/i);
      expect(login.sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(login.json.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    test("unknown email and wrong password → same status and body", async () => {
      const e = email();
      await call("/register", { body: { email: e, password: PASSWORD } });
      const wrong = await call("/login", { body: { email: e, password: "wrong password!" } });
      const unknown = await call("/login", { body: { email: email(), password: "wrong password!" } });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.text).toBe(unknown.text);
      expect(wrong.json).toEqual({ error: "invalid credentials" });
    });

    test("6th failed login within window → 429 with Retry-After", async () => {
      const e = email();
      await call("/register", { body: { email: e, password: PASSWORD } });
      for (let i = 0; i < 5; i++) {
        expect((await call("/login", { body: { email: e, password: "wrong password!" } })).status).toBe(401);
      }
      const blocked = await call("/login", { body: { email: e, password: PASSWORD } }); // even the right password
      expect(blocked.status).toBe(429);
      const ra = Number(blocked.headers.get("retry-after"));
      expect(Number.isInteger(ra)).toBe(true);
      expect(ra).toBeGreaterThanOrEqual(1);
      expect(ra).toBeLessThanOrEqual(900);
    });

    test("unknown emails are rate limited too", async () => {
      const e = email();
      for (let i = 0; i < 5; i++) await call("/login", { body: { email: e, password: "wrong password!" } });
      expect((await call("/login", { body: { email: e, password: "wrong password!" } })).status).toBe(429);
    });

    test("secure: login with attacker-chosen sid → response sid differs and attacker sid gives /me 401", async () => {
      const e = email();
      await call("/register", { body: { email: e, password: PASSWORD } });
      const attacker = "attacker-chosen-sid-0123456789";
      const login = await call("/login", { body: { email: e, password: PASSWORD }, sid: attacker });
      expect(login.status).toBe(200);
      expect(login.sid).not.toBe(attacker);
      expect((await call("/me", { sid: attacker })).status).toBe(401);
      expect((await call("/me", { sid: login.sid })).status).toBe(200);
    });

    test("secure: login deletes the session named by the incoming sid (rotation)", async () => {
      const a = await registerAndLogin();
      const again = await call("/login", { body: { email: a.email, password: PASSWORD }, sid: a.sid });
      expect(again.status).toBe(200);
      expect(again.sid).not.toBe(a.sid);
      expect((await call("/me", { sid: a.sid })).status).toBe(401);
    });

    test("vulnerable: login with attacker-chosen sid → attacker sid gives /me 200", async () => {
      const e = email();
      await call("/register", { body: { email: e, password: PASSWORD } });
      const attacker = "attacker-chosen-sid-0123456789";
      const login = await call("/login", { body: { email: e, password: PASSWORD }, sid: attacker, headers: VULN });
      expect(login.status).toBe(200);
      expect(login.sid).toBe(attacker);
      const me = await call("/me", { sid: attacker });
      expect(me.status).toBe(200);
      expect(me.json.email).toBe(e);
    });
  });

  describe("session", () => {
    test("/me without or with unknown sid → 401", async () => {
      expect((await call("/me")).status).toBe(401);
      expect((await call("/me", { sid: "nope" })).status).toBe(401);
    });

    test("/me → 200 {email}", async () => {
      const a = await registerAndLogin();
      const me = await call("/me", { sid: a.sid });
      expect(me.status).toBe(200);
      expect(me.json).toEqual({ email: a.email });
    });

    test("logout without CSRF token → 403; with token → 204, clears cookie; /me → 401", async () => {
      const a = await registerAndLogin();
      expect((await call("/logout", { method: "POST", sid: a.sid })).status).toBe(403);
      expect((await call("/me", { sid: a.sid })).status).toBe(200);
      const out = await call("/logout", { method: "POST", sid: a.sid, csrf: a.csrf });
      expect(out.status).toBe(204);
      const c = out.setCookies.find((x) => x.startsWith("sid="))!;
      expect(c).toMatch(/^sid=;/);
      expect(c).toMatch(/Max-Age=0/i);
      expect((await call("/me", { sid: a.sid })).status).toBe(401);
    });

    test("transfer without X-CSRF-Token → 403; wrong token → 403; with token → 200", async () => {
      const a = await registerAndLogin();
      const body = { to: "bob", amount: 10 };
      const none = await call("/transfer", { body, sid: a.sid });
      expect(none.status).toBe(403);
      expect(none.json).toEqual({ error: "csrf" });
      expect((await call("/transfer", { body, sid: a.sid, csrf: "x".repeat(43) })).status).toBe(403);
      const ok = await call("/transfer", { body, sid: a.sid, csrf: a.csrf });
      expect(ok.status).toBe(200);
      expect(ok.json).toEqual({ ok: true });
    });

    test("transfer without a session → 401", async () => {
      expect((await call("/transfer", { body: { to: "bob", amount: 1 } })).status).toBe(401);
    });

    test("vulnerable: transfer skips the CSRF check", async () => {
      const a = await registerAndLogin();
      const r = await call("/transfer", { body: { to: "bob", amount: 10 }, sid: a.sid, headers: VULN });
      expect(r.status).toBe(200);
      expect(r.json).toEqual({ ok: true });
    });
  });

  describe("attack helpers", () => {
    test("/__attack/* → 404 without vulnerable header", async () => {
      expect((await call("/__attack/plant-sid", { body: { sid: "abc" } })).status).toBe(404);
      expect((await call("/__attack/as", { body: { sid: "abc", path: "/me" } })).status).toBe(404);
    });

    test("plant-sid sets cookie sid=<value>", async () => {
      const r = await call("/__attack/plant-sid", { body: { sid: "planted-value-1" }, headers: VULN });
      expect(r.status).toBe(200);
      expect(r.sid).toBe("planted-value-1");
    });

    test("as replays a GET in-process with that sid → {status, body}", async () => {
      const a = await registerAndLogin();
      const r = await call("/__attack/as", { body: { sid: a.sid, path: "/me" }, headers: VULN });
      expect(r.status).toBe(200);
      expect(r.json.status).toBe(200);
      expect(JSON.parse(r.json.body)).toEqual({ email: a.email });
      const bad = await call("/__attack/as", { body: { sid: "nope", path: "/me" }, headers: VULN });
      expect(bad.json.status).toBe(401);
    });

    test("as rejects paths not starting with / or starting with /__attack", async () => {
      for (const path of ["me", "http://evil.test/me", "/__attack/as", "/__attack/plant-sid"]) {
        expect((await call("/__attack/as", { body: { sid: "x", path }, headers: VULN })).status).toBe(400);
      }
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
      const r = await call("/healthz", { headers: { Origin: "http://evil.test" } });
      expect(r.headers.get("access-control-allow-origin")).toBeNull();
    });
    test("actual responses echo the allowed origin and expose headers", async () => {
      const r = await call("/healthz", { headers: { Origin: "http://localhost:3000" } });
      expect(r.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
      expect(r.headers.get("access-control-expose-headers")).toBe("Retry-After, WWW-Authenticate, Location");
    });
  });

  describe("trace", () => {
    test("GET /__trace streams text/event-stream and replays recent requests", async () => {
      await call("/healthz");
      const ctl = new AbortController();
      const res = await fetch(`${BASE}/__trace`, { signal: ctl.signal });
      expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
      const reader = res.body!.getReader();
      let seen = "";
      const dec = new TextDecoder();
      while (!seen.includes("/healthz")) {
        const { value, done } = await reader.read();
        if (done) break;
        seen += dec.decode(value);
      }
      ctl.abort();
      expect(seen).toContain('"lab":"01"');
      expect(seen).toContain(`"impl":"${IMPL}"`);
    });
    test("passwords never appear in trace events", async () => {
      const marker = "S3cret-marker-" + Math.random().toString(36).slice(2);
      await call("/register", { body: { email: email(), password: marker } });
      const ctl = new AbortController();
      const res = await fetch(`${BASE}/__trace`, { signal: ctl.signal });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let seen = "";
      const t = Date.now();
      while (!seen.includes("/register") && Date.now() - t < 3000) {
        const { value, done } = await reader.read();
        if (done) break;
        seen += dec.decode(value);
      }
      ctl.abort();
      expect(seen).toContain("/register");
      expect(seen).not.toContain(marker);
    });
  });

  describe("interop", () => {
    let otherUp = false;
    beforeAll(async () => {
      if (!OTHER) return;
      try {
        otherUp = (await fetch(`${OTHER}/healthz`, { signal: AbortSignal.timeout(1500) })).ok;
      } catch { /* unreachable */ }
    });

    test("interop: user registered via other impl can log in", async (ctx) => {
      if (!otherUp) ctx.skip(OTHER ? `OTHER_URL ${OTHER} unreachable` : "OTHER_URL not set");
      const e = email();
      expect((await call("/register", { base: OTHER, body: { email: e, password: PASSWORD } })).status).toBe(201);
      const login = await call("/login", { body: { email: e, password: PASSWORD } });
      expect(login.status).toBe(200);
      expect((await call("/me", { sid: login.sid })).json.email).toBe(e);
    });
  });
});
