import { describe, expect, it } from "vitest";
import { course, getLesson, getLessonBySlug, moduleRefs, resolveRef } from "./registry";

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
