"use client";

import { useProgress } from "@/components/game/ProgressProvider";
import { useLesson } from "./LessonProvider";

export function LessonHeader() {
  const lesson = useLesson();
  const { isDone } = useProgress();
  const done = lesson.steps.filter((s) => isDone(`${lesson.id}/${s.id}`)).length;
  return (
    <header className="mb-8 max-w-3xl space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">{lesson.title}</h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span>{lesson.minutes} min</span>
        <ol className="flex items-center gap-1.5" aria-label={`${done} of ${lesson.steps.length} steps complete`}>
          {lesson.steps.map((s) => (
            <li key={s.id} title={s.title} className={`size-2.5 rounded-full ${isDone(`${lesson.id}/${s.id}`) ? "bg-brand" : "border bg-background"}`}>
              <span className="sr-only">{s.title}{isDone(`${lesson.id}/${s.id}`) ? ", done" : ""}</span>
            </li>
          ))}
        </ol>
      </div>
    </header>
  );
}
