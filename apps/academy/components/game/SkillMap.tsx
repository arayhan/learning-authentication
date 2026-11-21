import Link from "next/link";
import { Check, Circle, Lock } from "lucide-react";
import { course } from "@/lib/course/registry";
import { lessonStates, lessonUrl } from "./skill-state";

const ICON = { done: Check, available: Circle, locked: Lock } as const;
const LABEL = { done: "Done", available: "Available", locked: "Locked" } as const;

export function SkillMap({ completed }: { completed: readonly string[] }) {
  const states = lessonStates(completed);
  return (
    <section aria-labelledby="map-h" className="space-y-6">
      <h2 id="map-h" className="text-sm font-medium">Skill map</h2>
      {course.map((m) => {
        const doneCount = m.lessons.filter((l) => states.get(l.id) === "done").length;
        return (
          <div key={m.id} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm text-muted-foreground">{m.title}</h3>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{doneCount}/{m.lessons.length}</span>
            </div>
            <ol className="grid gap-2 sm:grid-cols-2">
              {m.lessons.map((l, i) => {
                const state = states.get(l.id)!;
                const Icon = ICON[state];
                const body = (
                  <>
                    <Icon className={`size-4 shrink-0 ${state === "done" ? "text-brand" : "text-muted-foreground"}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{i + 1}. </span>
                      {l.title}
                    </span>
                    <span className="sr-only">{LABEL[state]}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>{l.minutes}m</span>
                  </>
                );
                const cls = "flex items-center gap-2 rounded-lg border px-3 py-2";
                return (
                  <li key={l.id}>
                    {state === "locked" ? (
                      <span data-lesson={l.id} data-state={state} aria-disabled="true" className={`${cls} opacity-60`}>{body}</span>
                    ) : (
                      <Link
                        data-lesson={l.id}
                        data-state={state}
                        href={lessonUrl(l)}
                        className={`${cls} outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50`}
                      >
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
