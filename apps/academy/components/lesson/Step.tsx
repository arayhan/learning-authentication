"use client";

import { Check } from "lucide-react";
import { useCallback, useContext, useState } from "react";
import { useProgress } from "@/components/game/ProgressProvider";
import { Button } from "@/components/ui/button";
import { useLesson } from "./LessonProvider";
import { GateCtx, StepCtx } from "./stepContext";
import { useSender } from "./useSender";

/** One section of a lesson. Only rendered by <LessonSteps>, which reveals steps one at a time. */
export function Step({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  const lesson = useLesson();
  const info = useContext(StepCtx);
  const { isDone } = useProgress();
  const [gates, setGates] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const { fire, busy, awaitingLogin, openReauth } = useSender((o) => setFailed(!o.ok));
  const registerGate = useCallback((quizId: string) => {
    setGates((g) => [...g, quizId]);
    return () => setGates((g) => g.filter((x) => x !== quizId));
  }, []);

  if (!info) throw new Error("<Step> must be rendered inside <LessonSteps>");
  // Dev guard: a typo'd id would render fine but could never be completed.
  if (process.env.NODE_ENV !== "production" && !lesson.steps.some((s) => s.id === id)) {
    throw new Error(`<Step id="${id}"> is not in ${lesson.id}'s steps (${lesson.steps.map((s) => s.id).join(", ")})`);
  }

  const blocked = gates.some((q) => !isDone(`${lesson.id}/${q}`));
  const cont = () => {
    setFailed(false);
    void fire({ kind: "step", ref: `${lesson.id}/${id}` });
  };

  return (
    <section aria-labelledby={`step-${id}`} className="space-y-4 border-t py-8 first:border-t-0 first:pt-0">
      <h2 id={`step-${id}`} tabIndex={-1} className="flex scroll-mt-20 items-center gap-2 text-xl font-semibold tracking-tight outline-none">
        {info.done && <Check aria-label="Selesai" className="size-5 text-brand" />}
        {title}
      </h2>
      <GateCtx.Provider value={registerGate}>
        <div className="space-y-4">{children}</div>
      </GateCtx.Provider>
      {!info.done && (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button onClick={cont} disabled={blocked || busy}>
            {info.last ? "Selesaikan lesson" : "Lanjut"}
          </Button>
          {blocked && <p className="text-sm text-muted-foreground">Lulusin quiz dulu biar bisa lanjut.</p>}
          {awaitingLogin && (
            <>
              <p role="status" className="text-sm text-muted-foreground">Login lagi buat nyimpen progress kamu.</p>
              <Button variant="outline" onClick={openReauth}>Login lagi</Button>
            </>
          )}
          {failed && <p role="alert" className="text-sm text-destructive">Progress gagal disimpan. Coba lagi.</p>}
        </div>
      )}
    </section>
  );
}
