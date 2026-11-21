import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quizAttempts, xpEvents } from "@/lib/db/schema";
import { course, getLesson, moduleRefs, resolveRef } from "@/lib/course/registry";
import { POST as register } from "../auth/register/route";
import { GET, POST } from "./route";

const base = "http://localhost:3000/api/progress";
const tokenOf = (res: Response) => /academy_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1];
let cookie = "";
let userId = "";

beforeEach(async () => {
  await db.execute(sql`truncate table users cascade`);
  const res = await register(
    new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3000" },
      body: JSON.stringify({ email: "ada@example.com", password: "correct horse", displayName: "Ada" }),
    }),
  );
  cookie = `academy_session=${tokenOf(res)}`;
  userId = ((await db.execute(sql`select id from users`)) as unknown as { id: string }[])[0].id;
});

const rawPost = (body: unknown, c: string | null = cookie) =>
  POST(
    new NextRequest(base, {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3000", ...(c ? { cookie: c } : {}) },
      body: JSON.stringify(body),
    }),
  );
const post = async (event: unknown, tz = "UTC") => (await rawPost({ event, tz })).json();

test("same step event twice awards XP once", async () => {
  const a = await post({ kind: "step", ref: "m1-l1/hook" });
  const b = await post({ kind: "step", ref: "m1-l1/hook" });
  expect(a.gained).toBe(10);
  expect(b.gained).toBe(0);
  expect(b.xp).toBe(a.xp);
  expect(a.completed).toEqual(["m1-l1/hook"]);
});

test("10 concurrent identical events → xp 10", async () => {
  const rs = await Promise.all(
    Array.from({ length: 10 }, () => rawPost({ event: { kind: "step", ref: "m1-l1/hook" }, tz: "UTC" }).then((r) => r.json())),
  );
  expect(rs.reduce((n, r) => n + r.gained, 0)).toBe(10);
  const g = await GET(new NextRequest(`${base}?tz=UTC`, { headers: { cookie, host: "localhost:3000" } }));
  expect((await g.json()).xp).toBe(10);
  expect(await db.select().from(xpEvents).where(eq(xpEvents.userId, userId))).toHaveLength(1);
});

test("wrong quiz answers → 422, attempt stored, xp unchanged", async () => {
  const res = await rawPost({ event: { kind: "quiz", ref: "m1-l1/q1", answers: [1, 0] }, tz: "UTC" });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ score: 0, total: 2, passed: false });
  const attempts = await db.select().from(quizAttempts);
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ quizRef: "m1-l1/q1", score: 0, total: 2 });
  expect(await db.select().from(xpEvents)).toHaveLength(0);
});

test("correct quiz → 20 XP and recorded as completed", async () => {
  const a = await post({ kind: "quiz", ref: "m1-l1/q1", answers: [0, 1] });
  expect(a.gained).toBe(20);
  expect(a.completed).toContain("m1-l1/q1");
});

test("unknown ref → 400", async () => {
  expect((await rawPost({ event: { kind: "step", ref: "nope/x" }, tz: "UTC" })).status).toBe(400);
});

test("kind mismatching the ref's real kind → 400", async () => {
  expect((await rawPost({ event: { kind: "attack", ref: "m1-l1/hook" }, tz: "UTC" })).status).toBe(400);
});

test("malformed answers / elapsedMs → 400", async () => {
  const bad = [
    { kind: "quiz", ref: "m1-l1/q1", answers: [-2] },
    { kind: "quiz", ref: "m1-l1/q1", answers: ["0"] },
    { kind: "quiz", ref: "m1-l1/q1", answers: new Array(51).fill(0) },
    { kind: "boss", ref: "m1-l7/boss", answers: [0], elapsedMs: -5 },
    { kind: "boss", ref: "m1-l7/boss", answers: [0], elapsedMs: 1.5 },
    { kind: "boss", ref: "m1-l7/boss", answers: [0] },
  ];
  for (const event of bad) expect((await rawPost({ event, tz: "UTC" })).status).toBe(400);
  expect((await rawPost({ event: { kind: "step", ref: "m1-l1/hook" }, tz: "x".repeat(65) })).status).toBe(400);
});

test("boss with an unanswered (-1) answer inside the time limit → 422 (not 400), attempt stored as failed", async () => {
  const res = await rawPost({ event: { kind: "boss", ref: "m1-l7/boss", answers: [-1], elapsedMs: 1000 }, tz: "UTC" });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ score: 0, total: 1, passed: false });
  const attempts = await db.select().from(quizAttempts);
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ quizRef: "m1-l7/boss", score: 0, passed: false });
  expect(await db.select().from(xpEvents)).toHaveLength(0);
});

test("invalid tz falls back to UTC instead of failing", async () => {
  const res = await rawPost({ event: { kind: "step", ref: "m1-l1/hook" }, tz: "Not/AZone" });
  expect(res.status).toBe(200);
});

test("no session → 401", async () => {
  expect((await rawPost({ event: { kind: "step", ref: "m1-l1/hook" }, tz: "UTC" }, null)).status).toBe(401);
  expect((await GET(new NextRequest(base, { headers: { host: "localhost:3000" } }))).status).toBe(401);
});

test("cross-origin POST → 403", async () => {
  const res = await POST(
    new NextRequest(base, {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3000", origin: "http://evil.test", cookie },
      body: JSON.stringify({ event: { kind: "step", ref: "m1-l1/hook" }, tz: "UTC" }),
    }),
  );
  expect(res.status).toBe(403);
});

test("completing all m1 refs grants cookie-monster in newBadges exactly once", async () => {
  const m1 = course[0];
  const seen: string[] = [];
  let lastBoss: unknown;
  for (const ref of moduleRefs(m1)) {
    const { kind } = resolveRef(ref)!;
    const quiz = getLesson(ref.split("/")[0])!.quizzes.find((q) => `${q.id}` === ref.split("/")[1]);
    const event =
      kind === "quiz" ? { kind, ref, answers: quiz!.questions.map((q) => q.answer) }
      : kind === "boss" ? { kind, ref, answers: quiz!.questions.map((q) => q.answer), elapsedMs: 1000 }
      : { kind, ref };
    if (kind === "boss") lastBoss = event;
    const r = await post(event);
    expect(r.gained).toBeGreaterThan(0);
    seen.push(...r.newBadges);
  }
  expect(seen.filter((b) => b === "cookie-monster")).toHaveLength(1);
  expect(seen).toContain("flawless"); // boss passed with perfect score
  const g = await (await GET(new NextRequest(`${base}?tz=UTC`, { headers: { cookie, host: "localhost:3000" } }))).json();
  expect(g.badges).toContain("cookie-monster");
  // replaying the last ref yields no new badge
  expect((await post(lastBoss)).newBadges).toEqual([]);
});

describe("flawless", () => {
  const ref = "m1-l7/boss";
  const perfect = () => getLesson("m1-l7")!.quizzes.find((q) => q.id === "boss")!.questions.map((q) => q.answer);
  const badgesAfterStep = async () => (await post({ kind: "step", ref: "m1-l1/hook" })).badges;

  test("timed-out perfect boss -> 422, no flawless on a later award", async () => {
    const res = await rawPost({ event: { kind: "boss", ref, answers: perfect(), elapsedMs: 10_000_000 }, tz: "UTC" });
    expect(res.status).toBe(422);
    expect(await badgesAfterStep()).not.toContain("flawless");
  });

  test("over-long all-correct answers -> 422, no flawless", async () => {
    const res = await rawPost({ event: { kind: "boss", ref, answers: [...perfect(), 0], elapsedMs: 1000 }, tz: "UTC" });
    expect(res.status).toBe(422);
    expect(await badgesAfterStep()).not.toContain("flawless");
  });

  test("in-time perfect boss -> flawless", async () => {
    const r = await post({ kind: "boss", ref, answers: perfect(), elapsedMs: 1000 });
    expect(r.newBadges).toContain("flawless");
  });
});
