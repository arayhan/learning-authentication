import type { Quiz, XpEvent } from "@/lib/course/types";

const XP = { step: 10, quiz: 20, "lab-task": 15, attack: 30, boss: 100 } as const;

export const xpFor = (e: XpEvent): number => XP[e.kind];

export function gradeQuiz(quiz: Quiz, answers: number[], elapsedMs?: number) {
  const total = quiz.questions.length;
  const score = quiz.questions.filter((q, i) => answers[i] === q.answer).length;
  const lengthOk = answers.length === total;
  const b = quiz.boss;
  const passed = b
    ? lengthOk && score / total >= b.passRatio && elapsedMs !== undefined && elapsedMs <= b.seconds * 1000
    : lengthOk && score === total;
  return { score, total, passed };
}
