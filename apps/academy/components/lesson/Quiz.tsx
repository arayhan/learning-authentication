"use client";

import { useState } from "react";
import { ProgressError, useProgress } from "@/components/game/ProgressProvider";
import { Button } from "@/components/ui/button";
import { ChoiceButton, type ChoiceState } from "./ChoiceButton";
import { useLesson } from "./LessonProvider";
import { useGate } from "./stepContext";
import { useSender } from "./useSender";

type Fail = { score: number; total: number } | "error";

/** One question at a time with the `why` after each answer. Submits on the last one; a failed attempt can be retried. */
export function Quiz({ id, gate = false }: { id: string; gate?: boolean }) {
  const lesson = useLesson();
  const quiz = lesson.quizzes.find((q) => q.id === id && !q.boss);
  if (!quiz) throw new Error(`<Quiz id="${id}"> is not a quiz of ${lesson.id}`);
  const ref = `${lesson.id}/${id}`;
  const { isDone } = useProgress();
  useGate(id, gate);

  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [fail, setFail] = useState<Fail | null>(null);
  const { fire, awaitingLogin, openReauth } = useSender((o) => {
    if (o.ok) return;
    const body = o.error instanceof ProgressError && o.error.status === 422 ? (o.error.body as { score: number; total: number }) : null;
    setFail(body ? { score: body.score, total: body.total } : "error");
  });

  const total = quiz.questions.length;
  const submit = (a: number[]) => {
    setFail(null);
    void fire({ kind: "quiz", ref, answers: a });
  };
  const reset = () => {
    setAnswers([]);
    setPicked(null);
    setFail(null);
  };

  if (isDone(ref)) {
    return <p className="rounded-lg border bg-muted/40 p-4 text-sm font-medium">Quiz passed.</p>;
  }

  const i = answers.length;
  const q = quiz.questions[i];
  const next = () => {
    const a = [...answers, picked!];
    setAnswers(a);
    setPicked(null);
    if (a.length === total) submit(a);
  };

  return (
    <div role="group" aria-label="Quiz" className="space-y-4 rounded-lg border p-4">
      {fail && fail !== "error" ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm font-medium">
            You scored {fail.score} of {fail.total}. Every answer has to be right to pass.
          </p>
          <Button variant="outline" onClick={reset}>Try again</Button>
        </div>
      ) : fail === "error" ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">Could not submit your answers.</p>
          <Button variant="outline" onClick={() => submit(answers)}>Retry</Button>
        </div>
      ) : !q ? (
        <div className="space-y-3">
          <p role="status" className="text-sm text-muted-foreground">
            {awaitingLogin ? "Sign in again to submit your answers." : "Checking your answers…"}
          </p>
          {awaitingLogin && <Button variant="outline" onClick={openReauth}>Sign in again</Button>}
        </div>
      ) : (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Question {i + 1} of {total}
          </p>
          <p className="font-medium">{q.prompt}</p>
          <div className="space-y-2">
            {q.choices.map((c, k) => {
              const state: ChoiceState = picked === null ? "idle" : k === q.answer ? "correct" : k === picked ? "wrong" : "idle";
              return (
                <ChoiceButton key={k} state={state} disabled={picked !== null} onClick={() => setPicked(k)}>
                  {c}
                </ChoiceButton>
              );
            })}
          </div>
          {picked !== null && (
            <div className="space-y-3">
              <p role="status" className="text-sm">
                <span className="font-medium">{picked === q.answer ? "Correct. " : "Not quite. "}</span>
                {q.why}
              </p>
              <Button onClick={next}>{i === total - 1 ? "Finish" : "Next"}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
