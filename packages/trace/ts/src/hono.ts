import type { Context, Handler, MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";
import type { Hub } from "./hub";
import type { TraceEvent } from "./types";

const MAX_BODY = 4096;
const SUFFIX = "…[truncated]";
const REDACT = new Set(["password", "client_secret"]);

function sortRedact(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortRedact);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o).sort().map((k) => [k, REDACT.has(k) ? "[redacted]" : sortRedact(o[k])]),
    );
  }
  return v;
}

export function redactBody(raw: string, contentType: string): string | undefined {
  if (raw === "") return undefined;
  let out = raw;
  const ct = contentType.toLowerCase();
  if (ct.includes("application/json")) {
    try { out = JSON.stringify(sortRedact(JSON.parse(raw))); } catch { /* keep raw */ }
  } else if (ct.includes("application/x-www-form-urlencoded")) {
    const groups = new Map<string, string[]>();
    for (const [k, v] of new URLSearchParams(raw)) {
      const g = groups.get(k) ?? [];
      g.push(REDACT.has(k) ? "[redacted]" : v);
      groups.set(k, g);
    }
    const p = new URLSearchParams();
    for (const k of [...groups.keys()].sort()) for (const v of groups.get(k)!) p.append(k, v);
    out = p.toString();
  }
  const bytes = new TextEncoder().encode(out);
  if (bytes.length <= MAX_BODY) return out;
  let n = MAX_BODY;
  while (n > 0 && (bytes[n]! & 0xc0) === 0x80) n--; // don't split a UTF-8 rune
  return new TextDecoder().decode(bytes.subarray(0, n)) + SUFFIX;
}

export function traceMiddleware(
  hub: Hub,
  opts: { lab: TraceEvent["lab"]; impl: TraceEvent["impl"]; role: TraceEvent["role"] },
): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method === "OPTIONS" || c.req.path === "/__trace") return next();
    const start = performance.now();
    const reqBody = await c.req.raw.clone().text();
    await next();
    const res = c.res;
    const resBody = await res.clone().text();
    const reqHeaders: Record<string, string> = {};
    c.req.raw.headers.forEach((v, k) => { reqHeaders[k.toLowerCase()] = v; });
    const resHeaders: Record<string, string | string[]> = {};
    res.headers.forEach((v, k) => { if (k.toLowerCase() !== "set-cookie") resHeaders[k.toLowerCase()] = v; });
    const cookies = res.headers.getSetCookie();
    if (cookies.length) resHeaders["set-cookie"] = cookies;
    const reqB = redactBody(reqBody, reqHeaders["content-type"] ?? "");
    const resB = redactBody(resBody, res.headers.get("content-type") ?? "");
    hub.publish({
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      ...opts,
      req: {
        method: c.req.method, path: c.req.path, query: new URL(c.req.url).search.slice(1),
        headers: reqHeaders, ...(reqB !== undefined && { body: reqB }),
      },
      res: { status: res.status, headers: resHeaders, ...(resB !== undefined && { body: resB }) },
      durationMs: Math.round(performance.now() - start),
    });
  };
}

export function sseHandler(hub: Hub): Handler {
  return (c: Context) =>
    streamSSE(c, async (stream) => {
      const send = (e: TraceEvent) => { stream.writeSSE({ data: JSON.stringify(e) }).catch(() => {}); };
      // replay then subscribe with no await between: no event can slip into the gap
      for (const e of hub.recent()) send(e);
      const unsub = hub.subscribe(send);
      stream.onAbort(unsub);
      while (!stream.aborted) {
        await stream.sleep(15_000);
        if (!stream.aborted) await stream.write(": ping\n\n").catch(() => {});
      }
      unsub();
    });
}
