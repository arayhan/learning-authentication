"use client";

import { useEffect, useState } from "react";
import { ProgressError, useProgress } from "@/components/game/ProgressProvider";
import { Button } from "@/components/ui/button";
import { ChoiceButton } from "./ChoiceButton";
import { useLesson } from "./LessonProvider";
import { useGate } from "./stepContext";
import { useSender } from "./useSender";

type Phase = "idle" | "running" | "submitting" | "failed" | "error";

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Timed exam. Choices are shuffled per attempt; answers are mapped back to the original indexes before sending. No feedback until the end. */
export function BossQuiz({ id }: { id: string }) {
  const lesson = useLesson();
  const quiz = lesson.quizzes.find((q) => q.id === id && q.boss);
  if (!quiz?.boss) throw new Error(`<BossQuiz id="${id}"> is not a boss quiz of ${lesson.id}`);
  const { seconds, passRatio } = quiz.boss;
  const ref = `${lesson.id}/${id}`;
  const { isDone } = useProgress();
  useGate(id, true); // the step's Continue waits for the boss

  const [phase, setPhase] = useState<Phase>("idle");
  const [orders, setOrders] = useState<number[][]>([]); // orders[q][displayIdx] = original choice index
  const [answers, setAnswers] = useState<number[]>([]); // original indexes, -1 = unanswered
  const [qi, setQi] = useState(0);
  const [started, setStarted] = useState(0);
  const [left, setLeft] = useState(seconds * 1000);
  const [score, setScore] = useState<{ score: number; total: number } | null>(null);
  const { fire, awaitingLogin, openReauth } = useSender((o) => {
    if (o.ok) return;
    const body = o.error instanceof ProgressError && o.error.status === 422 ? (o.error.body as { score: number; total: number }) : null;
    setScore(body ? { score: body.score, total: body.total } : null);
    setPhase(body ? "failed" : "error");
  });

  const submit = (a: number[]) => {
    setPhase("submitting");
    // A timed-out attempt is graded on what was answered, so cap the clock at the limit.
    const elapsedMs = Math.min(Math.round(performance.now() - started), seconds * 1000);
    void fire({ kind: "boss", ref, answers: a, elapsedMs });
  };

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      const remaining = seconds * 1000 - (performance.now() - started);
      setLeft(remaining);
      if (remaining > 0) return;
      clearInterval(t); // stop now: a quick failed grade must not be followed by another timeout submit
      submit(answers);
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-armed on every answer so a timeout submits the latest ones
  }, [phase, answers, started, seconds]);

  if (isDone(ref)) return <p className="rounded-lg border bg-muted/40 p-4 text-sm font-medium">Boss kalah. Mantap!</p>;

  const start = () => {
    setOrders(quiz.questions.map((q) => shuffled(q.choices.length)));
    setAnswers(quiz.questions.map(() => -1));
    setQi(0);
    setScore(null);
    setLeft(seconds * 1000);
    setStarted(performance.now());
    setPhase("running");
  };

  const total = quiz.questions.length;
  const q = quiz.questions[qi];

  return (
    <div role="group" aria-label="Boss quiz" className="space-y-4 rounded-lg border p-4">
      {phase === "idle" && (
        <div className="space-y-3">
          <p className="text-sm">
            {total} pertanyaan, waktu {clock(seconds * 1000)}, lulus kalau minimal {Math.round(passRatio * 100)}%. Nggak ada hint sampai kamu selesai.
          </p>
          <Button onClick={start}>Mulai boss</Button>
        </div>
      )}
      {phase === "running" && (
        <>
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Pertanyaan {qi + 1} dari {total}</span>
            <span role="timer" className="font-mono tabular-nums">{clock(left)}</span>
          </div>
          <p className="font-medium">{q.prompt}</p>
          <div className="space-y-2">
            {orders[qi].map((orig) => (
              <ChoiceButton
                key={orig}
                state={answers[qi] === orig ? "selected" : "idle"}
                onClick={() => setAnswers((a) => a.map((v, k) => (k === qi ? orig : v)))}
              >
                {q.choices[orig]}
              </ChoiceButton>
            ))}
          </div>
          <Button disabled={answers[qi] < 0} onClick={() => (qi === total - 1 ? submit(answers) : setQi(qi + 1))}>
            {qi === total - 1 ? "Selesai" : "Berikutnya"}
          </Button>
        </>
      )}
      {phase === "submitting" && (
        <div className="space-y-3">
          <p role="status" className="text-sm text-muted-foreground">
            {awaitingLogin ? "Login lagi dulu buat kirim jawabanmu." : "Lagi dinilai…"}
          </p>
          {awaitingLogin && <Button variant="outline" onClick={openReauth}>Login lagi</Button>}
        </div>
      )}
      {phase === "failed" && (
        <div className="space-y-3">
          <p role="alert" className="text-sm font-medium">
            {score ? `Skor kamu ${score.score} dari ${score.total}.` : "Belum lulus."} Capai {Math.round(passRatio * 100)}% sebelum waktu habis.
          </p>
          <Button variant="outline" onClick={start}>Coba lagi</Button>
        </div>
      )}
      {phase === "error" && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">Jawabanmu gagal dikirim.</p>
          <Button variant="outline" onClick={() => submit(answers)}>Coba lagi</Button>
        </div>
      )}
    </div>
  );
}
