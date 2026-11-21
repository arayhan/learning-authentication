import { sseHandler, traceMiddleware, type Hub } from "@academy/trace";
import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import { jwks } from "./keys.ts";
import { naiveVerify } from "./naive.ts";
import { dummyVerify, verifyPassword } from "./password.ts";
import { clearRefreshCookie, newFamily, refreshCookie, revokeFamily, rotate } from "./refresh.ts";
import type { Store } from "./store.ts";
import { ACCESS_TTL, forge, issueAccess, verifyAccess } from "./tokens.ts";

const ALLOWED_ORIGIN = "http://localhost:3000";
const MAX_BODY = 1 << 20;
const MODES = ["none", "hs256-with-public-key", "expired"];

const len = (s: string) => [...s].length; // code points, like Go's utf8.RuneCountInString

type ErrStatus = 400 | 401 | 404 | 413 | 500;
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

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function createApp(store: Store, hub: Hub) {
  const app = new Hono();
  const { sql, keys } = store;

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
  app.use("*", traceMiddleware(hub, { lab: "02", impl: "ts", role: "app" }));

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
      return isObject(v) ? v : undefined;
    } catch {
      return undefined;
    }
  }

  // Responses that carry tokens or identity must never sit in a shared or browser cache.
  for (const p of ["/login", "/api/profile", "/refresh"]) {
    app.use(p, async (c, next) => {
      c.header("Cache-Control", "no-store");
      await next();
    });
  }

  app.get("/healthz", (c) => c.json({ ok: true }));
  app.get("/__trace", sseHandler(hub));
  app.get("/.well-known/jwks.json", (c) => c.json(jwks(keys)));

  const tokenResponse = (c: Context, accessToken: string) =>
    c.json({ access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TTL });

  app.post("/login", async (c) => {
    const body = await readJSON(c);
    if (!body) return err(c, 400, "invalid json");
    const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase();
    if (!email.includes("@") || len(email) > 254) return err(c, 400, "invalid email");
    const password = body.password;
    if (typeof password !== "string") return err(c, 400, "invalid password");

    const user = await store.findUser(email);
    if (!user) await dummyVerify(password); // same cost as a real verify: unknown email must not be timing-distinguishable
    if (!user || !(await verifyPassword(user.phc, password))) return err(c, 401, "invalid credentials"); // identical for unknown email and wrong password

    const access = await issueAccess(keys, user.id, email);
    c.header("Set-Cookie", refreshCookie(await newFamily(sql, user.id)), { append: true });
    return tokenResponse(c, access);
  });

  // RFC 6750: no credentials at all → bare `Bearer`; a bad token → error="invalid_token".
  const bearerUnauthorized = (c: Context, hadToken: boolean) => {
    c.header("WWW-Authenticate", hadToken ? 'Bearer error="invalid_token"' : "Bearer");
    return err(c, 401, hadToken ? "invalid token" : "unauthorized");
  };

  app.get("/api/profile", async (c) => {
    const m = /^(\S+)\s+(.*)$/.exec(c.req.header("authorization") ?? "");
    const token = m?.[2]?.trim();
    if (m?.[1]?.toLowerCase() !== "bearer" || !token) return bearerUnauthorized(c, false);
    let claims: Record<string, unknown>;
    try {
      claims = vulnerable(c)
        ? naiveVerify(token, keys) // VULNERABLE: trusts the token's own alg, ignores exp/aud/iss (see naive.ts)
        : await verifyAccess(keys, token);
    } catch {
      return bearerUnauthorized(c, true);
    }
    const { sub, email } = claims;
    return c.json({ sub: typeof sub === "string" ? sub : "", email: typeof email === "string" ? email : "" });
  });

  app.post("/refresh", async (c) => {
    const rt = getCookie(c, "rt");
    const rotated = rt ? await rotate(sql, rt) : undefined;
    if (!rotated) return err(c, 401, "invalid refresh token");
    const access = await issueAccess(keys, rotated.userId, rotated.email);
    c.header("Set-Cookie", refreshCookie(rotated.next), { append: true });
    return tokenResponse(c, access);
  });

  // Under /refresh because the rt cookie is only sent to Path=/refresh.
  app.post("/refresh/logout", async (c) => {
    const rt = getCookie(c, "rt");
    if (rt) await revokeFamily(sql, rt);
    c.header("Set-Cookie", clearRefreshCookie(), { append: true });
    return c.body(null, 204);
  });

  // Attack helper: 404 unless the request opted into vulnerable mode, so it is invisible by default.
  app.post("/__attack/sign", async (c) => {
    if (!vulnerable(c)) return err(c, 404, "not found");
    const body = await readJSON(c);
    if (!body) return err(c, 400, "invalid json");
    const { mode, header, payload } = body;
    // A missing header/payload is fine; a present non-object is not.
    const bad = (v: unknown) => v !== undefined && v !== null && !isObject(v);
    if (bad(header) || bad(payload)) return err(c, 400, "header and payload must be objects");
    if (typeof mode !== "string" || !MODES.includes(mode)) return err(c, 400, "mode must be none, hs256-with-public-key or expired");
    return c.json({ token: forge(keys, mode, (header ?? {}) as Record<string, unknown>, (payload ?? {}) as Record<string, unknown>) });
  });

  return app;
}
