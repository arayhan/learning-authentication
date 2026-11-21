import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { badges, lessonProgress, quizAttempts, xpEvents } from "@/lib/db/schema";
import { course, resolveRef } from "@/lib/course/registry";
import type { BadgeId, XpEvent } from "@/lib/course/types";
import { evaluateBadges } from "./badges";
import { levelFor } from "./levels";
import { gradeQuiz, xpFor } from "./rules";
import { streakDays } from "./streak";

export type ProgressState = {
  completed: string[];
  xp: number;
  level: ReturnType<typeof levelFor>;
  badges: BadgeId[];
  streak: number;
};
export type AwardResult = ProgressState & { gained: number; newBadges: BadgeId[] };

export class QuizFailed extends Error {
  constructor(public score: number, public total: number) {
    super("quiz failed");
  }
}

const bossRefs = new Set(
  course.flatMap((m) => m.lessons.flatMap((l) => l.quizzes.filter((q) => q.boss).map((q) => `${l.id}/${q.id}`))),
);

export function safeTz(tz: string | undefined): string {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz || "UTC";
  } catch {
    return "UTC";
  }
}

export async function getProgress(userId: string, tz: string): Promise<ProgressState> {
  const [progress, [{ xp }], earned, events] = await Promise.all([
    db.select({ ref: lessonProgress.ref }).from(lessonProgress).where(eq(lessonProgress.userId, userId)),
    db.select({ xp: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int` }).from(xpEvents).where(eq(xpEvents.userId, userId)),
    db.select({ id: badges.badgeId }).from(badges).where(eq(badges.userId, userId)),
    db.select({ at: xpEvents.createdAt }).from(xpEvents).where(eq(xpEvents.userId, userId)),
  ]);
  return {
    completed: progress.map((p) => p.ref),
    xp,
    level: levelFor(xp),
    badges: earned.map((b) => b.id as BadgeId),
    streak: streakDays(events.map((e) => e.at), safeTz(tz), new Date()),
  };
}

/** Idempotent: a repeated (kind, ref) records progress once and awards XP once. Throws QuizFailed on a failed quiz/boss. */
export async function award(userId: string, e: XpEvent, tz: string): Promise<AwardResult> {
  const info = resolveRef(e.ref);
  if (!info) throw new Error(`unknown ref ${e.ref}`);

  if (e.kind === "quiz" || e.kind === "boss") {
    const quiz = info.lesson.quizzes.find((q) => `${info.lesson.id}/${q.id}` === e.ref)!;
    const r = gradeQuiz(quiz, e.answers, e.kind === "boss" ? e.elapsedMs : undefined);
    await db.insert(quizAttempts).values({ userId, quizRef: e.ref, score: r.score, total: r.total });
    if (!r.passed) throw new QuizFailed(r.score, r.total);
  }

  const gained = await db.transaction(async (tx) => {
    await tx.insert(lessonProgress).values({ userId, ref: e.ref }).onConflictDoNothing();
    const ins = await tx
      .insert(xpEvents)
      .values({ userId, source: `${e.kind}:${e.ref}`, amount: xpFor(e) })
      .onConflictDoNothing({ target: [xpEvents.userId, xpEvents.source] })
      .returning({ id: xpEvents.id });
    return ins.length ? xpFor(e) : 0;
  });

  const state = await getProgress(userId, tz);
  const perfectBoss = (await db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId))).some(
    (a) => bossRefs.has(a.quizRef) && a.score === a.total,
  );
  const earned = evaluateBadges({ completed: new Set(state.completed), perfectBoss, streak: state.streak });
  const inserted = earned.length
    ? await db
        .insert(badges)
        .values(earned.map((badgeId) => ({ userId, badgeId })))
        .onConflictDoNothing()
        .returning({ id: badges.badgeId })
    : [];
  const newBadges = inserted.map((b) => b.id as BadgeId);
  return { ...state, badges: [...new Set([...state.badges, ...newBadges])], gained, newBadges };
}
