import type { CourseModule, LessonMeta } from "./types";
import m1l1 from "@/content/m1/01-identity/lesson";
import m1l2 from "@/content/m1/02-password-storage/lesson";
import m1l3 from "@/content/m1/03-sessions-cookies/lesson";
import m1l4 from "@/content/m1/04-session-lifecycle/lesson";
import m1l5 from "@/content/m1/05-csrf/lesson";
import m1l6 from "@/content/m1/06-rate-limit-enumeration/lesson";
import m1l7 from "@/content/m1/07-boss/lesson";
import m2l1 from "@/content/m2/01-jwt-anatomy/lesson";
import m2l2 from "@/content/m2/02-signing-jwks/lesson";
import m2l3 from "@/content/m2/03-access-refresh/lesson";
import m2l4 from "@/content/m2/04-token-storage/lesson";
import m2l5 from "@/content/m2/05-jwt-attacks/lesson";
import m2l6 from "@/content/m2/06-revocation/lesson";
import m2l7 from "@/content/m2/07-boss/lesson";
import m3l1 from "@/content/m3/01-delegation/lesson";
import m3l2 from "@/content/m3/02-auth-code-flow/lesson";
import m3l3 from "@/content/m3/03-client-types/lesson";
import m3l4 from "@/content/m3/04-pkce/lesson";
import m3l5 from "@/content/m3/05-scopes-state-redirect/lesson";
import m3l6 from "@/content/m3/06-client-credentials/lesson";
import m3l7 from "@/content/m3/07-summary-boss/lesson";

export const course: CourseModule[] = [
  {
    id: "m1",
    slug: "passwords-sessions",
    title: "Password & Session",
    summary: "Pelajari cara menyimpan password dengan aman, dan gimana session, cookie, CSRF, dan rate limit menjaga sistem login tetap jujur.",
    badge: "cookie-monster",
    lessons: [m1l1, m1l2, m1l3, m1l4, m1l5, m1l6, m1l7],
  },
  {
    id: "m2",
    slug: "jwt-tokens",
    title: "JWT & Tokens",
    summary: "Pahami cara JWT dibangun, di-sign, dan diverifikasi, bagaimana access dan refresh token bekerja sama, serta bagaimana token diserang dan di-revoke.",
    badge: "token-smith",
    lessons: [m2l1, m2l2, m2l3, m2l4, m2l5, m2l6, m2l7],
  },
  {
    id: "m3",
    slug: "oauth2-pkce",
    title: "OAuth 2.0 + PKCE",
    summary: "Ikuti delegated authorization dari authorization code flow sampai PKCE, scope, state, dan client credentials.",
    badge: "code-verifier",
    lessons: [m3l1, m3l2, m3l3, m3l4, m3l5, m3l6, m3l7],
  },
];

const lessons = course.flatMap((m) => m.lessons);

export const getLesson = (id: string): LessonMeta | undefined => lessons.find((l) => l.id === id);

export const getLessonBySlug = (moduleSlug: string, lessonSlug: string): LessonMeta | undefined => {
  const m = course.find((c) => c.slug === moduleSlug);
  return m?.lessons.find((l) => l.slug === lessonSlug);
};

export function resolveRef(
  ref: string,
): { lesson: LessonMeta; kind: "step" | "quiz" | "boss" | "lab-task" | "attack" } | null {
  const i = ref.indexOf("/");
  if (i < 0) return null;
  const lesson = getLesson(ref.slice(0, i));
  if (!lesson) return null;
  const id = ref.slice(i + 1);
  if (lesson.steps.some((s) => s.id === id)) return { lesson, kind: "step" };
  const quiz = lesson.quizzes.find((q) => q.id === id);
  if (quiz) return { lesson, kind: quiz.boss ? "boss" : "quiz" };
  if (lesson.labTasks.some((t) => t.id === id)) return { lesson, kind: "lab-task" };
  if (lesson.attacks.some((a) => a.id === id)) return { lesson, kind: "attack" };
  return null;
}

// Every step/quiz/lab-task/attack ref once; the boss quiz (<lastLessonId>/boss) is a quiz, so it is included.
export const moduleRefs = (m: CourseModule): string[] =>
  m.lessons.flatMap((l) => [
    ...l.steps.map((s) => `${l.id}/${s.id}`),
    ...l.quizzes.map((q) => `${l.id}/${q.id}`),
    ...l.labTasks.map((t) => `${l.id}/${t.id}`),
    ...l.attacks.map((a) => `${l.id}/${a.id}`),
  ]);
