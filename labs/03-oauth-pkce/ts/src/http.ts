import type { Context, Hono, MiddlewareHandler } from "hono";

const MAX_BODY = 1 << 20;

/** Allowed browser origins: exact matches only, identical in the Go lab. */
const CORS_ORIGINS = new Set([
  "http://localhost:3000", // the academy
  "http://localhost:4113", // the SPA served by the Go lab
  "http://localhost:4213", // the SPA served by the TS lab
]);

export type ErrStatus = 400 | 401 | 403 | 404 | 413 | 500 | 503;
export const err = (c: Context, status: ErrStatus, msg: string) => c.json({ error: msg }, status);

export const cors: MiddlewareHandler = async (c, next) => {
  c.header("Vary", "Origin", { append: true });
  const origin = c.req.header("origin");
  if (origin && CORS_ORIGINS.has(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Access-Control-Expose-Headers", "WWW-Authenticate, Location");
    if (c.req.method === "OPTIONS") {
      c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Lab-Mode");
    }
  }
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
};

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

/** Caps bodies at 1 MiB BEFORE the trace middleware (which reads whole bodies): 413 in both labs. */
export const limitBody: MiddlewareHandler = async (c, next) => {
  if (await bodyTooLarge(c.req.raw)) return err(c, 413, "body too large");
  await next();
};

export function jsonNotFound(app: Hono) {
  app.notFound((c) => err(c, 404, "not found"));
  app.onError((e, c) => {
    console.error("internal error:", e);
    return err(c, 500, "internal error");
  });
}

/** Per-request opt-in to the deliberately weak behaviour used by the attack demos. */
export const vulnerableHeader = (c: Context) => c.req.header("x-lab-mode") === "vulnerable";
