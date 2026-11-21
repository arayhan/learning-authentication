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

describe("module 1 content", () => {
  const dir = path.join(__dirname, "../../content/m1");
  const mdx = readdirSync(dir).map((d) => ({ d, src: readFileSync(path.join(dir, d, "index.mdx"), "utf8") }));

  it("every <CodeTabs> reference resolves to a non-empty, fully in-range snippet (catches line drift in the labs)", async () => {
    const refs = mdx.flatMap(({ d, src }) => [...src.matchAll(/\b(?:go|ts)="(labs\/[^"]+)"/g)].map((m) => ({ d, spec: m[1] })));
    expect(refs.length).toBeGreaterThan(10);
    for (const { d, spec } of refs) {
      const { range } = parseSpec(spec);
      expect(range, `${d}: ${spec} needs a #Lx-Ly range`).toBeDefined();
      const snip = await readSnippet(spec);
      expect(snip.ok, `${d}: ${spec}`).toBe(true);
      if (!snip.ok) continue;
      expect(snip.code.trim(), `${d}: ${spec} is empty`).not.toBe("");
      expect(snip.code.split("\n").length,`${d}: ${spec} runs past the end of the file`).toBe(range![1] - range![0] + 1);
    }
  });

  it("lessons 2 to 6 each cite lab code in both languages", () => {
    for (const { d, src } of mdx.filter((m) => /^0[2-6]/.test(m.d))) {
      expect(src, d).toMatch(/<CodeTabs[^>]*\bgo="labs\/01-sessions\/go\//);
      expect(src, d).toMatch(/<CodeTabs[^>]*\bts="labs\/01-sessions\/ts\/src\//);
    }
  });

  it("every lesson has a gated quiz of 3 questions with a why (boss: 10 questions, 600s, 0.8), and every recap has 3+ interview answers", () => {
    for (const l of course[0].lessons) {
      for (const q of l.quizzes) {
        expect(q.questions, `${l.id}/${q.id}`).toHaveLength(q.boss ? 10 : 3);
        for (const x of q.questions) {
          expect(x.why.length).toBeGreaterThan(20);
          expect(x.answer).toBeLessThan(x.choices.length);
          expect(new Set(x.choices).size).toBe(x.choices.length);
        }
      }
    }
    expect(getLesson("m1-l7")!.quizzes[0].boss).toEqual({ seconds: 600, passRatio: 0.8 });
    for (const { d, src } of mdx.filter((m) => !m.d.startsWith("07"))) {
      expect([...src.matchAll(/\bq: "/g)].length, d).toBeGreaterThanOrEqual(3);
    }
  });
});
