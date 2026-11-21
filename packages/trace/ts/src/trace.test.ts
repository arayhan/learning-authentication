import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { createHub, sseHandler, traceMiddleware, type TraceEvent } from "./index";

const golden = JSON.parse(
  readFileSync(new URL("../../fixtures/event.golden.json", import.meta.url), "utf8"),
);

function setup() {
  const hub = createHub();
  const app = new Hono();
  app.use("*", traceMiddleware(hub, { lab: "01", impl: "ts", role: "app" }));
  app.get("/__trace", sseHandler(hub));
  app.post("/login", (c) => {
    c.header("Set-Cookie", "sid=abc; HttpOnly; SameSite=Lax; Path=/", { append: true });
    c.header("Set-Cookie", "theme=dark; Path=/", { append: true });
    return c.json({ ok: true });
  });
  app.all("/ping", (c) => c.text("pong"));
  return { hub, app };
}

const login = (app: Hono) =>
  app.request("/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"password":"x","email":"a@b.c"}',
  });

function normalize(e: TraceEvent) {
  const pick = (h: Record<string, unknown>, keys: string[]) =>
    Object.fromEntries(Object.entries(h).filter(([k]) => keys.includes(k)));
  return {
    ...e, id: "", ts: "", durationMs: 0, impl: "x",
    req: { ...e.req, headers: pick(e.req.headers, ["content-type", "cookie", "authorization"]) },
    res: { ...e.res, headers: pick(e.res.headers, ["content-type", "set-cookie"]) },
  };
}

describe("trace middleware", () => {
  it("matches the golden event", async () => {
    const { hub, app } = setup();
    await login(app);
    expect(hub.recent()).toHaveLength(1);
    expect(normalize(hub.recent()[0]!)).toEqual(golden);
  });

  it("redacts password and client_secret in JSON and form bodies, any depth", async () => {
    const { hub, app } = setup();
    await app.request("/ping", {
      method: "POST", headers: { "content-type": "application/json" },
      body: '{"a":{"client_secret":"s"},"password":"p"}',
    });
    await app.request("/ping", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "z=1&password=p&client_secret=s&a=2",
    });
    const [j, f] = hub.recent();
    expect(j!.req.body).toBe('{"a":{"client_secret":"[redacted]"},"password":"[redacted]"}');
    expect(f!.req.body).toBe("a=2&client_secret=%5Bredacted%5D&password=%5Bredacted%5D&z=1");
  });

  it("truncates bodies to 4096 bytes and keeps query", async () => {
    const { hub, app } = setup();
    await app.request("/ping?x=1&y=2", { method: "POST", body: "a".repeat(5000) });
    const e = hub.recent()[0]!;
    expect(e.req.query).toBe("x=1&y=2");
    expect(e.req.body).toBe("a".repeat(4096) + "…[truncated]");
  });

  it("skips OPTIONS and /__trace", async () => {
    const { hub, app } = setup();
    await app.request("/ping", { method: "OPTIONS" });
    const r = await app.request("/__trace");
    await r.body?.cancel();
    expect(hub.recent()).toHaveLength(0);
  });

  it("hub is a bounded ring and survives a throwing subscriber", () => {
    const hub = createHub(2);
    const got: string[] = [];
    hub.subscribe(() => { throw new Error("boom"); });
    hub.subscribe((e) => got.push(e.id));
    for (const id of ["1", "2", "3"]) hub.publish({ id } as TraceEvent);
    expect(hub.recent().map((e) => e.id)).toEqual(["2", "3"]);
    expect(got).toEqual(["1", "2", "3"]);
  });

  it("SSE replays recent events, then streams live ones", async () => {
    const { hub, app } = setup();
    await login(app);
    const res = await app.request("/__trace");
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let text = "";
    const until = async (n: number) => {
      while ((text.match(/\n\n/g) ?? []).length < n) text += dec.decode((await reader.read()).value);
    };
    await until(1);
    expect(text.startsWith("data: ")).toBe(true);
    expect(JSON.parse(text.slice(6).split("\n")[0]!).req.path).toBe("/login");
    await app.request("/ping");
    await until(2);
    expect(text).toContain('"path":"/ping"');
    await reader.cancel();
    expect(hub.recent()).toHaveLength(2);
  });
});
