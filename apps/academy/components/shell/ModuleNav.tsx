"use client";

import Link from "next/link";
import { course } from "@/lib/course/registry";
import { useProgress } from "@/components/game/ProgressProvider";
import { lessonStates, lessonUrl } from "@/components/game/skill-state";

export function ModuleNav() {
  const states = lessonStates(useProgress().state.completed);
  return (
    <nav aria-label="Course" className="space-y-5">
      {course.map((m) => (
        <div key={m.id} className="space-y-1">
          <h2 className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{m.title}</h2>
          <ul>
            {m.lessons.map((l, i) => {
              const s = states.get(l.id)!;
              const row = "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm";
              const label = (
                <>
                  <span className="w-4 font-mono text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  <span className="sr-only">{s}</span>
                  {s === "done" && <span aria-hidden className="size-1.5 rounded-full bg-brand" />}
                </>
              );
              return (
                <li key={l.id}>
                  {s === "locked" ? (
                    <span aria-disabled="true" className={`${row} text-muted-foreground opacity-60`}>{label}</span>
                  ) : (
                    <Link href={lessonUrl(l)} className={`${row} outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50`}>
                      {label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
