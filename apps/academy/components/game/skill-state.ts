import { course } from "@/lib/course/registry";
import type { LessonMeta } from "@/lib/course/types";

export type LessonState = "done" | "available" | "locked";

export const lessons: LessonMeta[] = course.flatMap((m) => m.lessons);

export const lessonUrl = (l: LessonMeta) => `/m/${course.find((m) => m.id === l.module)!.slug}/${l.slug}`;

const stepRefs = (l: LessonMeta) => l.steps.map((s) => `${l.id}/${s.id}`);
const allRefs = (l: LessonMeta) => [
  ...stepRefs(l),
  ...l.quizzes.map((q) => `${l.id}/${q.id}`),
  ...l.labTasks.map((t) => `${l.id}/${t.id}`),
  ...l.attacks.map((a) => `${l.id}/${a.id}`),
];

/** Lesson N unlocks when every step of lesson N-1 (course order, across modules) is done; the first lesson is always open. */
export function lessonStates(completed: readonly string[]): Map<string, LessonState> {
  const done = new Set(completed);
  const out = new Map<string, LessonState>();
  lessons.forEach((l, i) => {
    const unlocked = i === 0 || stepRefs(lessons[i - 1]).every((r) => done.has(r));
    out.set(l.id, allRefs(l).every((r) => done.has(r)) ? "done" : unlocked ? "available" : "locked");
  });
  return out;
}

/** First lesson the learner can open that still has work left, or undefined when the whole course is done. */
export const nextLesson = (completed: readonly string[]) => {
  const states = lessonStates(completed);
  return lessons.find((l) => states.get(l.id) === "available");
};
