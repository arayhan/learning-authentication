"use client";

import Link from "next/link";
import { Children, isValidElement, useEffect, useRef } from "react";
import { useProgress } from "@/components/game/ProgressProvider";
import { lessonUrl, lessons } from "@/components/game/skill-state";
import { useLesson } from "./LessonProvider";
import { StepCtx } from "./stepContext";

/**
 * Reveals <Step>s one at a time. Everything is derived from server progress: completed steps stay visible,
 * the first incomplete one is the active step, later ones are hidden. A reload therefore restores the position,
 * and a failed or unauthorized send changes nothing.
 */
export function LessonSteps({ children }: { children: React.ReactNode }) {
  const lesson = useLesson();
  const { isDone } = useProgress();
  const steps = Children.toArray(children).filter((c): c is React.ReactElement<{ id: string }> => isValidElement(c));
  const done = steps.map((s) => isDone(`${lesson.id}/${s.props.id}`));
  const active = done.indexOf(false); // -1 once every step is done
  const first = useRef(true);

  // Focus + scroll to the active step when resuming mid-lesson and after each Continue. Not on a fresh start.
  useEffect(() => {
    const initial = first.current;
    first.current = false;
    if (active < 0 || (initial && active === 0)) return;
    const el = document.getElementById(`step-${steps[active].props.id}`);
    if (!el) return;
    el.focus({ preventScroll: true });
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView?.({ block: "start", behavior: calm ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `steps` is rebuilt every render; `active` is the real trigger
  }, [active]);

  const next = lessons[lessons.findIndex((l) => l.id === lesson.id) + 1];

  return (
    <div className="max-w-3xl">
      {steps.map((s, i) =>
        done[i] || i === active ? (
          <StepCtx.Provider key={s.props.id} value={{ index: i, done: done[i], last: i === steps.length - 1 }}>
            {s}
          </StepCtx.Provider>
        ) : null,
      )}
      {active < 0 && steps.length > 0 && (
        <p className="border-t pt-6 text-sm text-muted-foreground">
          Lesson complete.{" "}
          {next && (
            <Link href={lessonUrl(next)} className="font-medium text-brand underline-offset-4 hover:underline">
              Next: {next.title}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
