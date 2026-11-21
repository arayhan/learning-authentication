"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Circle } from "lucide-react";
import { useProgress } from "@/components/game/ProgressProvider";
import { useLesson } from "@/components/lesson/LessonProvider";
import type { LabId, LabTask } from "@/lib/course/types";
import { useLabImpl } from "./LabImpl";
import { OfflineCard } from "./OfflineCard";
import { useTraceStream } from "./useTraceStream";

/** Lab tasks of the current lesson. They tick themselves when a matching request shows up in the lab trace. */
export function LabTasks() {
  const lesson = useLesson();
  if (!lesson.labTasks.length) return null;
  return <TaskList lessonId={lesson.id} tasks={lesson.labTasks} lab={lesson.labTasks[0].lab} />;
}

function TaskList({ lessonId, tasks, lab }: { lessonId: string; tasks: LabTask[]; lab: LabId }) {
  const [impl] = useLabImpl();
  const { status, events } = useTraceStream(lab, impl);
  const { send, isDone, reauthCount } = useProgress();
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const claimed = useRef(new Set<string>()); // matched once per mount: never sent twice
  const parked = useRef(new Set<string>()); // got "unauthorized", retry after re-login
  const seenReauth = useRef(reauthCount);

  const fire = useCallback(
    (id: string) => {
      send({ kind: "lab-task", ref: `${lessonId}/${id}` })
        .then((r) => {
          if (r === "unauthorized") parked.current.add(id);
          else setTicked((t) => new Set(t).add(id));
        })
        .catch(() => claimed.current.delete(id)); // transient failure: a later matching event retries
    },
    [send, lessonId],
  );

  useEffect(() => {
    for (const t of tasks) {
      if (claimed.current.has(t.id) || isDone(`${lessonId}/${t.id}`)) continue;
      if (events.some((e) => t.match(e))) {
        claimed.current.add(t.id);
        fire(t.id);
      }
    }
  }, [events, tasks, lessonId, isDone, fire]);

  useEffect(() => {
    if (reauthCount === seenReauth.current) return;
    seenReauth.current = reauthCount;
    for (const id of [...parked.current]) {
      parked.current.delete(id);
      fire(id);
    }
  }, [reauthCount, fire]);

  return (
    <div className="max-w-3xl space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Lab tasks</h3>
      {status === "offline" && <OfflineCard lab={lab} impl={impl} />}
      <ul className="space-y-2">
        {tasks.map((t) => {
          const done = ticked.has(t.id) || isDone(`${lessonId}/${t.id}`);
          return (
            <li key={t.id} className="flex items-start gap-2 text-sm">
              {done ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Circle aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
              <div>
                <p className={done ? "text-muted-foreground line-through" : undefined}>
                  {t.label}
                  <span className="sr-only">{done ? " (done)" : " (not done)"}</span>
                </p>
                <p className="text-xs text-muted-foreground">{t.hint}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
