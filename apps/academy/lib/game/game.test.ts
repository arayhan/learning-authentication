import { describe, expect, it } from "vitest";
import { course } from "@/lib/course/registry";
import type { Quiz } from "@/lib/course/types";
import { evaluateBadges } from "./badges";
import { levelFor } from "./levels";
import { gradeQuiz, xpFor } from "./rules";
import { streakDays } from "./streak";

const q: Quiz = {
  id: "q1",
  questions: [
    { prompt: "a", choices: ["x", "y"], answer: 1, why: "" },
    { prompt: "b", choices: ["x", "y"], answer: 0, why: "" },
  ],
};
const boss: Quiz = {
  id: "boss",
  boss: { seconds: 600, passRatio: 0.8 },
  questions: Array.from({ length: 5 }, () => ({ prompt: "p", choices: ["x", "y"], answer: 0, why: "" })),
};

describe("levels", () => {
  it("maps xp to level", () => {
    expect(levelFor(0).name).toBe("Intern");
    expect(levelFor(299).name).toBe("Intern");
    expect(levelFor(300)).toEqual({ name: "Junior", min: 300, next: 900 });
    expect(levelFor(899).name).toBe("Junior");
    expect(levelFor(4000)).toEqual({ name: "Principal", min: 4000, next: null });
  });
});

describe("xpFor", () => {
  it("uses fixed values", () => {
    expect(xpFor({ kind: "step", ref: "m1-l1/hook" })).toBe(10);
    expect(xpFor({ kind: "quiz", ref: "m1-l1/q1", answers: [] })).toBe(20);
    expect(xpFor({ kind: "lab-task", ref: "x" })).toBe(15);
    expect(xpFor({ kind: "attack", ref: "x" })).toBe(30);
    expect(xpFor({ kind: "boss", ref: "m1-l7/boss", answers: [], elapsedMs: 0 })).toBe(100);
  });
});

describe("gradeQuiz", () => {
  it("normal quiz needs all correct", () => {
    expect(gradeQuiz(q, [1, 0])).toEqual({ score: 2, total: 2, passed: true });
    expect(gradeQuiz(q, [q.questions[0].answer, 99]).passed).toBe(false);
  });
  it("wrong length is not passed", () => {
    expect(gradeQuiz(q, [1]).passed).toBe(false);
    expect(gradeQuiz(q, [1, 0, 0]).passed).toBe(false);
  });
  it("-1 (unanswered) is always wrong", () => {
    expect(gradeQuiz(q, [-1, -1])).toEqual({ score: 0, total: 2, passed: false });
    expect(gradeQuiz(boss, [0, 0, 0, 0, -1], 1000)).toMatchObject({ score: 4, passed: true });
    expect(gradeQuiz(boss, [0, 0, 0, -1, -1], 1000).passed).toBe(false);
  });
  it("boss needs ratio and time", () => {
    expect(gradeQuiz(boss, [0, 0, 0, 0, 1], 1000)).toMatchObject({ score: 4, total: 5, passed: true });
    expect(gradeQuiz(boss, [0, 0, 0, 1, 1], 1000).passed).toBe(false);
    expect(gradeQuiz(boss, [0, 0, 0, 0, 0], 600_001).passed).toBe(false);
    expect(gradeQuiz(boss, [0, 0, 0, 0, 0], 600_000).passed).toBe(true);
    expect(gradeQuiz(boss, [0, 0, 0, 0, 0]).passed).toBe(false);
  });
});

describe("streakDays", () => {
  const now = new Date("2026-11-21T05:00:00Z");
  it("counts local days in the timezone", () => {
    const d = [new Date("2026-11-19T20:00:00Z"), new Date("2026-11-20T18:00:00Z")];
    expect(streakDays(d, "Asia/Jakarta", now)).toBe(2);
  });
  it("is 0 when last event is older than yesterday", () => {
    expect(streakDays([new Date("2026-11-18T03:00:00Z")], "UTC", now)).toBe(0);
  });
  it("counts from yesterday, dedupes same day, breaks on gap", () => {
    const d = [
      new Date("2026-11-20T01:00:00Z"),
      new Date("2026-11-20T09:00:00Z"),
      new Date("2026-11-19T09:00:00Z"),
      new Date("2026-11-17T09:00:00Z"),
    ];
    expect(streakDays(d, "UTC", now)).toBe(2);
  });
  it("falls back to UTC for bad timezone", () => {
    expect(streakDays([new Date("2026-11-21T01:00:00Z")], "Not/AZone", now)).toBe(1);
  });
  it("is 0 with no events", () => {
    expect(streakDays([], "UTC", now)).toBe(0);
  });
});

describe("evaluateBadges", () => {
  const m1 = course[0];
  const refs = (await_m: typeof m1) => new Set(
    await_m.lessons.flatMap((l) => [
      ...l.steps.map((s) => `${l.id}/${s.id}`),
      ...l.quizzes.map((z) => `${l.id}/${z.id}`),
      ...l.labTasks.map((t) => `${l.id}/${t.id}`),
      ...l.attacks.map((a) => `${l.id}/${a.id}`),
    ]),
  );
  it("awards module badge when all refs complete", () => {
    expect(evaluateBadges({ completed: new Set(), perfectBoss: false, streak: 0 })).toEqual([]);
    expect(evaluateBadges({ completed: refs(m1), perfectBoss: false, streak: 0 })).toContain("cookie-monster");
  });
  it("awards streak and flawless", () => {
    expect(evaluateBadges({ completed: new Set(), perfectBoss: true, streak: 7 })).toEqual(["on-call", "flawless"]);
    expect(evaluateBadges({ completed: new Set(), perfectBoss: false, streak: 6 })).toEqual([]);
  });
  it("red-team needs every attack in the course, not just module 1's", () => {
    const attackRefs = (mods: typeof course) => mods.flatMap((m) => m.lessons.flatMap((l) => l.attacks.map((a) => `${l.id}/${a.id}`)));
    const all = attackRefs(course);
    expect(all.length).toBeGreaterThan(attackRefs([m1]).length); // module 2 contributes attacks
    expect(evaluateBadges({ completed: new Set(), perfectBoss: false, streak: 0 })).not.toContain("red-team");
    expect(evaluateBadges({ completed: refs(m1), perfectBoss: false, streak: 0 })).not.toContain("red-team"); // M1 alone is not enough
    expect(evaluateBadges({ completed: new Set(all.slice(1)), perfectBoss: false, streak: 0 })).not.toContain("red-team");
    expect(evaluateBadges({ completed: new Set(all), perfectBoss: false, streak: 0 })).toContain("red-team");
  });
});
