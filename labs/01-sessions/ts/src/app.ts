import { sseHandler, traceMiddleware, type Hub } from "@academy/trace";
import { Hono, type Context } from "hono";
import { dummyVerify, hashPassword, verifyPassword } from "./password.ts";
import { clearCookie, csrfEqual, hashToken, newToken, sessionCookie, SID_RE, sidFromCookie } from "./session.ts";
import { DuplicateEmail, type Store } from "./store.ts";

const ALLOWED_ORIGIN = "http://localhost:3000";
const MAX_BODY = 1 << 20;

const len = (s: string) => [...s].length; // code points, like Go's utf8.RuneCountInString

type ErrStatus = 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500;
const err = (c: Context, status: ErrStatus, msg: string) => c.json({ error: msg }, status);

async function bodyTooLarge(req: Request): Promise<boolean> {
  if (Number(req.headers.get("content-length")) > MAX_BODY) return true;
  if (!req.body) return false;
  const reader = req.clone().body!.getReader(); // chunked bodies have no length: count while reading
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return false;
    n += value.length;
    if (n > MAX_BODY) {
      await reader.cancel();
      return true;
    }
  }
}

export function createApp(store: Store, ui: string, hub: Hub) {
  const app = new Hono();

  // CORS: one allowed origin (echoed only on exact match) with credentials. Identical in the Go lab.
  app.use("*", async (c, next) => {
    c.header("Vary", "Origin", { append: true });
    if (c.req.header("origin") === ALLOWED_ORIGIN) {
      c.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Access-Control-Expose-Headers", "Retry-After, WWW-Authenticate, Location");
      if (c.req.method === "OPTIONS") {
        c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Lab-Mode");
      }
    }
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  });
  // Cap bodies at 1 MiB BEFORE the trace middleware (which reads whole bodies): 413 in both labs.
  app.use("*", async (c, next) => {
    if (await bodyTooLarge(c.req.raw)) return err(c, 413, "body too large");
    await next();
  });
  app.use("*", traceMiddleware(hub, { lab: "01", impl: "ts", role: "app" }));

  app.notFound((c) => err(c, 404, "not found"));
  app.onError((e, c) => {
    console.error("internal error:", e);
    return err(c, 500, "internal error");
  });

  // VULNERABLE mode: per-request opt-in to the deliberately weak behaviour used by the attack demos.
  const vulnerable = (c: Context) => c.req.header("x-lab-mode") === "vulnerable";

  /** A JSON object sent as application/json, or undefined. */
  async function readJSON(c: Context): Promise<Record<string, unknown> | undefined> {
    const ct = (c.req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (ct !== "application/json") return undefined;
    try {
      const v = JSON.parse(await c.req.text());
      return v && typeof v === "object" && !Array.isArray(v) ? v : undefined;
    } catch {
      return undefined;
    }
  }

  /** Validates and normalizes {email,password}. `lenient` skips the 8-128 length rule (login). */
  function credentials(body: Record<string, unknown>, lenient: boolean): { email: string; password: string } | { error: string } {
    const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase();
    if (!email.includes("@") || len(email) > 254) return { error: "invalid email" };
    const password = body.password;
    if (typeof password !== "string" || (!lenient && (len(password) < 8 || len(password) > 128))) return { error: "invalid password" };
    return { email, password };
  }

  // Responses that carry credentials or identity must never sit in a shared or browser cache.
  for (const p of ["/register", "/login", "/me"]) {
    app.use(p, async (c, next) => {
      c.header("Cache-Control", "no-store");
      await next();
    });
  }

  app.get("/", (c) => c.html(ui));
  app.get("/healthz", (c) => c.json({ ok: true }));
  app.get("/__trace", sseHandler(hub));

  app.post("/register", async (c) => {
    const body = await readJSON(c);
    if (!body) return err(c, 400, "invalid json");
    const cred = credentials(body, false);
    if ("error" in cred) return err(c, 400, cred.error);
    const phc = await hashPassword(cred.password);
    try {
      return c.json({ id: await store.createUser(cred.email, phc), email: cred.email }, 201);
    } catch (e) {
      if (e instanceof DuplicateEmail) return err(c, 409, "email already registered");
      throw e;
    }
  });

  app.post("/login", async (c) => {
    const body = await readJSON(c);
    if (!body) return err(c, 400, "invalid json");
    const cred = credentials(body, true);
    if ("error" in cred) return err(c, 400, cred.error);
    const { email, password } = cred;

    const r = await store.authenticate(email, async (phc) => {
      if (phc === undefined) {
        await dummyVerify(password); // same cost as a real verify: unknown email must not be timing-distinguishable
        return false;
      }
      return verifyPassword(phc, password);
    });
    if (r.outcome === "blocked") {
      c.header("Retry-After", String(r.retryAfter));
      return err(c, 429, "too many attempts");
    }
    if (r.outcome === "rejected") return err(c, 401, "invalid credentials"); // identical for unknown email and wrong password

    const incoming = sidFromCookie(c.req.header("cookie"));
    let token = newToken();
    if (vulnerable(c) && SID_RE.test(incoming)) {
      token = incoming; // VULNERABLE: session fixation. The attacker-chosen id becomes the authenticated session.
    } else if (incoming) {
      await store.deleteSession(hashToken(incoming)); // secure: rotate, and kill whatever session the client presented
    }
    const csrf = newToken();
    await store.createSession(hashToken(token), r.userId, csrf);
    c.header("Set-Cookie", sessionCookie(token), { append: true });
    return c.json({ csrfToken: csrf });
  });

  /** The live session for the sid cookie, or undefined. */
  const auth = async (c: Context) => {
    const sid = sidFromCookie(c.req.header("cookie"));
    return sid ? store.findSession(hashToken(sid)) : undefined;
  };

  app.get("/me", async (c) => {
    const sess = await auth(c);
    return sess ? c.json({ email: sess.email }) : err(c, 401, "unauthorized");
  });

  app.post("/logout", async (c) => {
    const sess = await auth(c);
    if (!sess) return err(c, 401, "unauthorized");
    if (!csrfEqual(c.req.header("x-csrf-token") ?? "", sess.csrf)) return err(c, 403, "csrf");
    await store.deleteSession(hashToken(sidFromCookie(c.req.header("cookie"))));
    c.header("Set-Cookie", clearCookie(), { append: true });
    return c.body(null, 204);
  });

  app.post("/transfer", async (c) => {
    const sess = await auth(c);
    if (!sess) return err(c, 401, "unauthorized");
    // VULNERABLE mode skips the CSRF check.
    if (!vulnerable(c) && !csrfEqual(c.req.header("x-csrf-token") ?? "", sess.csrf)) return err(c, 403, "csrf");
    const body = await readJSON(c);
    if (!body) return err(c, 400, "invalid json");
    const { to, amount } = body;
    if (typeof to !== "string" || to === "" || typeof amount !== "number" || !(amount > 0) || !Number.isFinite(amount)) {
      return err(c, 400, "invalid transfer");
    }
    return c.json({ ok: true }); // demo only: no balances are kept
  });

  // Attack helpers: 404 unless the request opted into vulnerable mode, so they are invisible by default.
  // plant-sid simulates cookie injection: browsers forbid scripts setting Cookie headers, so the lab does it.
  app.post("/__attack/plant-sid", async (c) => {
    if (!vulnerable(c)) return err(c, 404, "not found");
    const body = await readJSON(c);
    if (!body) return err(c, 400, "invalid json");
    if (typeof body.sid !== "string" || !SID_RE.test(body.sid)) return err(c, 400, "invalid sid");
    c.header("Set-Cookie", sessionCookie(body.sid), { append: true });
    return c.json({ ok: true });
  });

  // Replays a GET carrying the given sid, in-process through the full app (no network loopback).
  // The replay is traced like any request, so the Inspector shows it as its own event.
  app.post("/__attack/as", async (c) => {
    if (!vulnerable(c)) return err(c, 404, "not found");
    const body = await readJSON(c);
    if (!body) return err(c, 400, "invalid json");
    const { sid, path } = body;
    if (typeof sid !== "string" || !SID_RE.test(sid) || typeof path !== "string" || !path.startsWith("/") || path.startsWith("/__")) {
      return err(c, 400, "invalid sid or path");
    }
    let res: Response;
    try {
      res = await app.request(`http://lab.local${path}`, { headers: { cookie: `sid=${sid}` } });
    } catch {
      return err(c, 400, "invalid sid or path");
    }
    return c.json({ status: res.status, body: await res.text() });
  });

  return app;
}
