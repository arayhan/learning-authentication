import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpec, readSnippet } from "@/components/lesson/snippet";
import { course, getLesson, getLessonBySlug, moduleRefs, resolveRef } from "./registry";
import type { TraceEvent } from "./types";

describe("registry", () => {
  it("has 3 modules, m1 has 7 lessons, every lesson has a step", () => {
    expect(course.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(course[0].lessons).toHaveLength(7);
    for (const m of course) for (const l of m.lessons) expect(l.steps.length).toBeGreaterThanOrEqual(1);
  });
  it("ref ids are unique across the course", () => {
    const all = course.flatMap(moduleRefs);
    expect(new Set(all).size).toBe(all.length);
  });
  it("moduleRefs includes the boss ref once", () => {
    const refs = moduleRefs(course[0]);
    expect(refs.filter((r) => r === "m1-l7/boss")).toHaveLength(1);
  });
  it("resolveRef", () => {
    expect(resolveRef("m1-l1/hook")).toMatchObject({ kind: "step", lesson: { id: "m1-l1" } });
    expect(resolveRef("m1-l1/q1")?.kind).toBe("quiz");
    expect(resolveRef("m1-l7/boss")?.kind).toBe("boss");
    expect(resolveRef("m9-l1/x")).toBeNull();
    expect(resolveRef("m1-l1/nope")).toBeNull();
    expect(resolveRef("garbage")).toBeNull();
  });
  it("lookups", () => {
    expect(getLesson("m2-l3")?.slug).toBe("access-refresh");
    expect(getLesson("zz")).toBeUndefined();
    expect(getLessonBySlug("jwt-tokens", "jwt-attacks")?.id).toBe("m2-l5");
    expect(getLessonBySlug("jwt-tokens", "nope")).toBeUndefined();
  });
});

const ev = (
  method: string,
  p: string,
  status: number,
  o: { reqHeaders?: Record<string, string>; resHeaders?: TraceEvent["res"]["headers"]; body?: string } = {},
): TraceEvent => ({
  id: "e1",
  ts: "2026-01-01T00:00:00Z",
  lab: "01",
  impl: "go",
  role: "app",
  req: { method, path: p, query: "", headers: o.reqHeaders ?? {} },
  res: { status, headers: o.resHeaders ?? {}, body: o.body },
  durationMs: 1,
});

describe("m1 lab tasks", () => {
  const sid = "sid=abc; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax";
  // For every task: an event that must match and a near miss that must not.
  const cases: Record<string, { hit: TraceEvent; miss: TraceEvent[] }> = {
    "m1-l2/register-201": {
      hit: ev("POST", "/register", 201),
      miss: [ev("POST", "/register", 409), ev("POST", "/login", 201), ev("GET", "/register", 201)],
    },
    "m1-l2/login-200": {
      hit: ev("POST", "/login", 200),
      miss: [ev("POST", "/login", 401), ev("GET", "/login", 200), ev("POST", "/me", 200)],
    },
    "m1-l3/set-cookie-httponly": {
      hit: ev("POST", "/login", 200, { resHeaders: { "set-cookie": [sid] } }),
      miss: [
        ev("POST", "/login", 200, { resHeaders: { "set-cookie": ["sid=abc; Path=/; SameSite=Lax"] } }),
        ev("POST", "/login", 200, { resHeaders: { "set-cookie": ["sid=abc; Path=/; HttpOnly; SameSite=Strict"] } }),
        ev("POST", "/login", 200),
      ],
    },
    "m1-l3/me-200": { hit: ev("GET", "/me", 200), miss: [ev("GET", "/me", 401), ev("POST", "/me", 200), ev("GET", "/healthz", 200)] },
    "m1-l4/logout-204": { hit: ev("POST", "/logout", 204), miss: [ev("POST", "/logout", 403), ev("POST", "/logout", 401), ev("GET", "/logout", 204)] },
    "m1-l5/transfer-403": {
      hit: ev("POST", "/transfer", 403, { body: '{"error":"csrf"}' }),
      miss: [
        ev("POST", "/transfer", 403, { reqHeaders: { "x-csrf-token": "wrong" } }), // a wrong token is not the "no token" lesson
        ev("POST", "/transfer", 401),
        ev("POST", "/transfer", 200),
      ],
    },
    "m1-l5/transfer-200": {
      hit: ev("POST", "/transfer", 200, { reqHeaders: { "x-csrf-token": "abc" } }),
      miss: [ev("POST", "/transfer", 200), ev("POST", "/transfer", 403, { reqHeaders: { "x-csrf-token": "abc" } }), ev("POST", "/logout", 200, { reqHeaders: { "x-csrf-token": "abc" } })],
    },
    "m1-l6/login-429": { hit: ev("POST", "/login", 429), miss: [ev("POST", "/login", 401), ev("POST", "/register", 429), ev("GET", "/login", 429)] },
    "m1-l6/generic-401": {
      hit: ev("POST", "/login", 401, { body: '{"error":"invalid credentials"}' }),
      miss: [
        ev("POST", "/login", 401, { body: '{"error":"no such user"}' }),
        ev("GET", "/me", 401, { body: '{"error":"unauthorized"}' }),
        ev("POST", "/login", 401),
        ev("POST", "/login", 429, { body: '{"error":"invalid credentials"}' }),
      ],
    },
  };

  it("covers every lab task of module 1 exactly once", () => {
    const all = course[0].lessons.flatMap((l) => l.labTasks.map((t) => `${l.id}/${t.id}`));
    expect(all.sort()).toEqual(Object.keys(cases).sort());
    for (const l of course[0].lessons) for (const t of l.labTasks) expect(t.lab).toBe("01");
  });

  for (const [ref, { hit, miss }] of Object.entries(cases)) {
    it(`${ref}: matches its event, ignores near misses`, () => {
      const [lesson, id] = ref.split("/");
      const task = getLesson(lesson)!.labTasks.find((t) => t.id === id)!;
      expect(task.match(hit)).toBe(true);
      for (const m of miss) expect(task.match(m)).toBe(false);
    });
  }
});

describe("m2 lab tasks", () => {
  const rt = "rt=abc; Path=/refresh; Max-Age=1209600; HttpOnly; SameSite=Strict";
  const e02 = (method: string, p: string, status: number, o: Parameters<typeof ev>[3] = {}): TraceEvent => ({ ...ev(method, p, status, o), lab: "02" });
  const tokenBody = '{"access_token":"eyJ.x.y","token_type":"Bearer","expires_in":300}';
  const cases: Record<string, { hit: TraceEvent; miss: TraceEvent[] }> = {
    "m2-l2/jwks-fetched": {
      hit: e02("GET", "/.well-known/jwks.json", 200),
      miss: [e02("GET", "/.well-known/jwks.json", 500), e02("POST", "/.well-known/jwks.json", 200), e02("GET", "/jwks.json", 200)],
    },
    "m2-l3/login-access-token": {
      hit: e02("POST", "/login", 200, { body: tokenBody }),
      miss: [e02("POST", "/login", 401, { body: '{"error":"invalid credentials"}' }), e02("POST", "/login", 200), e02("POST", "/login", 200, { body: '{"ok":true}' }), e02("GET", "/login", 200, { body: tokenBody })],
    },
    "m2-l3/refresh-rotated": {
      hit: e02("POST", "/refresh", 200, { resHeaders: { "set-cookie": [rt] }, body: tokenBody }),
      miss: [
        e02("POST", "/refresh", 200),
        e02("POST", "/refresh", 200, { resHeaders: { "set-cookie": ["sid=abc; Path=/"] } }),
        e02("POST", "/refresh", 401, { resHeaders: { "set-cookie": [rt] } }),
        e02("POST", "/refresh/logout", 204, { resHeaders: { "set-cookie": [rt] } }),
        e02("POST", "/login", 200, { resHeaders: { "set-cookie": [rt] } }),
      ],
    },
    "m2-l3/refresh-reuse-401": {
      hit: e02("POST", "/refresh", 401, { body: '{"error":"invalid refresh token"}' }),
      miss: [e02("POST", "/refresh", 200), e02("POST", "/login", 401), e02("GET", "/refresh", 401), e02("POST", "/refresh/logout", 401)],
    },
    "m2-l6/logout-revokes": {
      hit: e02("POST", "/refresh/logout", 204),
      miss: [e02("POST", "/refresh/logout", 500), e02("POST", "/logout", 204), e02("POST", "/refresh", 204), e02("GET", "/refresh/logout", 204)],
    },
  };

  it("covers every lab task of module 2 exactly once, all on lab 02", () => {
    const all = course[1].lessons.flatMap((l) => l.labTasks.map((t) => `${l.id}/${t.id}`));
    expect(all.sort()).toEqual(Object.keys(cases).sort());
    for (const l of course[1].lessons) for (const t of l.labTasks) expect(t.lab).toBe("02");
  });

  for (const [ref, { hit, miss }] of Object.entries(cases)) {
    it(`${ref}: matches its event, ignores near misses`, () => {
      const [lesson, id] = ref.split("/");
      const task = getLesson(lesson)!.labTasks.find((t) => t.id === id)!;
      expect(task.match(hit)).toBe(true);
      for (const m of miss) expect(task.match(m)).toBe(false);
    });
  }
});

describe("ref namespace", () => {
  it("step, quiz, lab-task and attack ids are unique within every lesson", () => {
    for (const l of course.flatMap((m) => m.lessons)) {
      const ids = [...l.steps.map((s) => s.id), ...l.quizzes.map((q) => q.id), ...l.labTasks.map((t) => t.id), ...l.attacks.map((a) => a.id)];
      expect(new Set(ids).size, `${l.id}: ${ids.join(", ")}`).toBe(ids.length);
    }
  });
});

describe.each([
  { m: 0, dir: "m1", labDir: "01-sessions", boss: "m1-l7" },
  { m: 1, dir: "m2", labDir: "02-jwt", boss: "m2-l7" },
  { m: 2, dir: "m3", labDir: "03-oauth-pkce", boss: "m3-l7" },
])("module $dir content", ({ m, dir: modDir, labDir, boss }) => {
  const dir = path.join(__dirname, "../../content", modDir);
  const mdx = readdirSync(dir).map((d) => ({ d, src: readFileSync(path.join(dir, d, "index.mdx"), "utf8") }));

  it("every <CodeTabs> reference resolves to a non-empty, fully in-range snippet (catches line drift in the labs)", async () => {
    const refs = mdx.flatMap(({ d, src }) => [...src.matchAll(/\b(?:go|ts)="(labs\/[^"]+)"/g)].map((x) => ({ d, spec: x[1] })));
    expect(refs.length).toBeGreaterThan(10);
    for (const { d, spec } of refs) {
      const { range } = parseSpec(spec);
      expect(range, `${d}: ${spec} needs a #Lx-Ly range`).toBeDefined();
      const snip = await readSnippet(spec);
      expect(snip.ok, `${d}: ${spec}`).toBe(true);
      if (!snip.ok) continue;
      expect(snip.code.trim(), `${d}: ${spec} is empty`).not.toBe("");
      expect(snip.code.split("\n").length, `${d}: ${spec} runs past the end of the file`).toBe(range![1] - range![0] + 1);
    }
  });

  it("lessons 1 to 6 each cite lab code in both languages", () => {
    for (const { d, src } of mdx.filter((x) => /^0[1-6]/.test(x.d))) {
      expect(src, d).toMatch(new RegExp(`<CodeTabs[^>]*\\bgo="labs/${labDir}/go/`));
      expect(src, d).toMatch(new RegExp(`<CodeTabs[^>]*\\bts="labs/${labDir}/ts/src/`));
    }
  });

  it("every lesson has a gated quiz of 3 questions with a why (boss: 10 questions, 600s, 0.8), and every recap has 3+ interview answers", () => {
    for (const l of course[m].lessons) {
      for (const q of l.quizzes) {
        expect(q.questions, `${l.id}/${q.id}`).toHaveLength(q.boss ? 10 : 3);
        for (const x of q.questions) {
          expect(x.why.length).toBeGreaterThan(20);
          expect(x.answer).toBeLessThan(x.choices.length);
          expect(new Set(x.choices).size).toBe(x.choices.length);
        }
      }
    }
    expect(getLesson(boss)!.quizzes[0].boss).toEqual({ seconds: 600, passRatio: 0.8 });
    for (const { d, src } of mdx.filter((x) => !x.d.startsWith("07"))) {
      expect([...src.matchAll(/\bq: "/g)].length, d).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("module 3 CodeTabs notes", () => {
  // `notes` is keyed by absolute line number and shared by the Go and TS panels, so a key must fall inside exactly one
  // of the two ranges of its block: otherwise a note is dropped, or shown on the wrong language.
  it("every note line lands in exactly one of its block's two ranges", () => {
    const dir = path.join(__dirname, "../../content/m3");
    for (const d of readdirSync(dir)) {
      const src = readFileSync(path.join(dir, d, "index.mdx"), "utf8");
      for (const [block] of src.matchAll(/<CodeTabs[\s\S]*?\/>/g)) {
        const ranges = [...block.matchAll(/#L(\d+)-L(\d+)"/g)].map((r) => [Number(r[1]), Number(r[2])]);
        const notes = block.match(/notes=\{\{([\s\S]*?)\}\}/)?.[1] ?? "";
        for (const [, line] of notes.matchAll(/^\s*(\d+):/gm)) {
          const hits = ranges.filter(([a, b]) => Number(line) >= a && Number(line) <= b).length;
          expect(hits, `${d}: note ${line} must be inside exactly one range`).toBe(1);
        }
      }
    }
  });
});

describe("m3 lab tasks", () => {
  const e03 = (
    role: TraceEvent["role"],
    method: string,
    p: string,
    status: number,
    o: { reqHeaders?: Record<string, string>; resHeaders?: TraceEvent["res"]["headers"]; reqBody?: string; body?: string } = {},
  ): TraceEvent => ({
    id: "e1",
    ts: "2026-01-01T00:00:00Z",
    lab: "03",
    impl: "go",
    role,
    req: { method, path: p, query: "", headers: o.reqHeaders ?? {}, body: o.reqBody },
    res: { status, headers: o.resHeaders ?? {}, body: o.body },
    durationMs: 1,
  });
  const codeForm = "grant_type=authorization_code&client_id=demo-spa&code=abc&redirect_uri=http%3A%2F%2Flocalhost%3A4113%2Fcallback";
  const withVerifier = `${codeForm}&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`;
  const credForm = "grant_type=client_credentials&scope=photos.read";
  const tokenBody = '{"access_token":"eyJ.x.y","token_type":"Bearer","expires_in":300,"scope":"photos.read"}';
  const loc = (code: string) => ({ location: `http://localhost:4113/callback?${code}&state=xyz` });

  const cases: Record<string, { hit: TraceEvent; miss: TraceEvent[] }> = {
    "m3-l2/authorize-302-code": {
      hit: e03("as", "POST", "/consent", 302, { resHeaders: loc("code=abc") }),
      miss: [
        e03("as", "POST", "/consent", 302, { resHeaders: loc("error=access_denied") }), // denied: no code
        e03("as", "POST", "/consent", 403),
        e03("as", "GET", "/consent", 302, { resHeaders: loc("code=abc") }),
        e03("as", "GET", "/authorize", 302, { resHeaders: loc("code=abc") }),
        e03("client", "POST", "/consent", 302, { resHeaders: loc("code=abc") }),
        e03("as", "POST", "/consent", 302, { resHeaders: { location: "http://localhost:4113/callback?state=xyz&barcode=1" } }), // "code=" inside another name
      ],
    },
    "m3-l2/token-200": {
      hit: e03("as", "POST", "/token", 200, { reqBody: codeForm, body: tokenBody }),
      miss: [
        e03("as", "POST", "/token", 200, { reqBody: credForm, body: tokenBody }), // that is lesson 6
        e03("as", "POST", "/token", 400, { reqBody: codeForm, body: '{"error":"invalid_grant"}' }),
        e03("as", "GET", "/token", 200, { reqBody: codeForm, body: tokenBody }),
        e03("as", "POST", "/token", 200, { reqBody: codeForm }),
        e03("api", "POST", "/token", 200, { reqBody: codeForm, body: tokenBody }),
      ],
    },
    "m3-l2/api-200-bearer": {
      hit: e03("api", "GET", "/api/photos", 200, { reqHeaders: { authorization: "Bearer eyJ.x.y" } }),
      miss: [
        e03("api", "GET", "/api/photos", 200),
        e03("api", "GET", "/api/photos", 200, { reqHeaders: { authorization: "Basic abc" } }),
        e03("api", "GET", "/api/photos", 401, { reqHeaders: { authorization: "Bearer eyJ.x.y" } }),
        e03("api", "GET", "/api/photos", 403, { reqHeaders: { authorization: "Bearer eyJ.x.y" } }),
        e03("api", "POST", "/api/photos", 200, { reqHeaders: { authorization: "Bearer eyJ.x.y" } }),
        e03("as", "GET", "/api/photos", 200, { reqHeaders: { authorization: "Bearer eyJ.x.y" } }),
      ],
    },
    "m3-l4/token-400-bad-verifier": {
      hit: e03("as", "POST", "/token", 400, { reqBody: withVerifier, body: '{"error":"invalid_grant"}' }),
      miss: [
        e03("as", "POST", "/token", 400, { reqBody: codeForm, body: '{"error":"invalid_grant"}' }), // no verifier sent at all
        e03("as", "POST", "/token", 400, { reqBody: withVerifier, body: '{"error":"invalid_request"}' }),
        e03("as", "POST", "/token", 200, { reqBody: withVerifier, body: tokenBody }),
        e03("as", "POST", "/token", 400, { reqBody: `grant_type=refresh_token&code_verifier=x`, body: '{"error":"invalid_grant"}' }),
        e03("api", "POST", "/token", 400, { reqBody: withVerifier, body: '{"error":"invalid_grant"}' }),
      ],
    },
    "m3-l5/api-403-scope": {
      hit: e03("api", "GET", "/api/photos", 403, { reqHeaders: { authorization: "Bearer eyJ.x.y" }, body: '{"error":"insufficient_scope"}' }),
      miss: [
        e03("api", "GET", "/api/photos", 401, { body: '{"error":"invalid_token"}' }),
        e03("api", "GET", "/api/photos", 403, { body: '{"error":"forbidden"}' }),
        e03("api", "GET", "/api/photos", 200, { body: '{"photos":[]}' }),
        e03("as", "GET", "/api/photos", 403, { body: '{"error":"insufficient_scope"}' }),
        e03("api", "POST", "/api/photos", 403, { body: '{"error":"insufficient_scope"}' }),
      ],
    },
    "m3-l5/authorize-400-redirect": {
      hit: e03("as", "GET", "/authorize", 400),
      miss: [
        e03("as", "GET", "/authorize", 200), // login or consent page
        e03("as", "GET", "/authorize", 302, { resHeaders: { location: "http://localhost:4113/callback?error=invalid_scope" } }), // errors after the redirect check are redirected
        e03("as", "POST", "/authorize", 400),
        e03("as", "GET", "/token", 400),
        e03("api", "GET", "/authorize", 400),
      ],
    },
    "m3-l6/client-credentials-200": {
      hit: e03("as", "POST", "/token", 200, { reqBody: credForm, body: tokenBody }),
      miss: [
        e03("as", "POST", "/token", 200, { reqBody: codeForm, body: tokenBody }),
        e03("as", "POST", "/token", 401, { reqBody: credForm, body: '{"error":"invalid_client"}' }),
        e03("as", "POST", "/token", 400, { reqBody: credForm, body: '{"error":"invalid_scope"}' }),
        e03("as", "GET", "/token", 200, { reqBody: credForm, body: tokenBody }),
        e03("as", "POST", "/token", 200, { reqBody: credForm }),
      ],
    },
  };

  it("covers every lab task of module 3 exactly once, all on lab 03", () => {
    const all = course[2].lessons.flatMap((l) => l.labTasks.map((t) => `${l.id}/${t.id}`));
    expect(all.sort()).toEqual(Object.keys(cases).sort());
    for (const l of course[2].lessons) for (const t of l.labTasks) expect(t.lab).toBe("03");
  });

  it("authorize-302-code accepts a Location header recorded as a list", () => {
    const task = getLesson("m3-l2")!.labTasks.find((t) => t.id === "authorize-302-code")!;
    expect(task.match(e03("as", "POST", "/consent", 302, { resHeaders: { location: ["http://localhost:4113/callback?code=abc&state=x"] } }))).toBe(true);
  });

  for (const [ref, { hit, miss }] of Object.entries(cases)) {
    it(`${ref}: matches its event, ignores near misses`, () => {
      const [lesson, id] = ref.split("/");
      const task = getLesson(lesson)!.labTasks.find((t) => t.id === id)!;
      expect(task.match(hit)).toBe(true);
      for (const m of miss) expect(task.match(m)).toBe(false);
    });
  }
});

describe("module 3 attacks", () => {
  it("declares the brief's attacks", () => {
    const attacks = (id: string) => getLesson(id)!.attacks.map((a) => `${a.id}:${a.kind}`);
    expect(attacks("m3-l4")).toEqual(["code-interception:live"]);
    expect(attacks("m3-l5")).toEqual(["redirect-prefix:live"]);
  });
});

describe("module 2 attacks", () => {
  it("declares the brief's attacks", () => {
    const attacks = (id: string) => getLesson(id)!.attacks.map((a) => `${a.id}:${a.kind}`);
    expect(attacks("m2-l4")).toEqual(["xss-storage:simulated"]);
    expect(attacks("m2-l5")).toEqual(["alg-none:live", "key-confusion:live", "expired:live"]);
  });
});
