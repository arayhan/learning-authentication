"use client";

import { useId, useSyncExternalStore } from "react";
import { useLesson } from "./LessonProvider";

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const read = (key: string) => {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
  listeners.forEach((f) => f());
};

/** Self-check: explain it out loud, then tick off what your answer covered. Stored in this browser only, never sent anywhere. */
export function ExplainBack({ prompt, rubric }: { prompt: string; rubric: string[] }) {
  const lesson = useLesson();
  const uid = useId();
  const key = `academy:explain:${lesson.id}:${prompt}`;
  const raw = useSyncExternalStore(subscribe, () => read(key), () => "");
  const ticked = new Set(raw ? raw.split(",") : []);
  const toggle = (i: number) => {
    const next = new Set(ticked);
    if (!next.delete(String(i))) next.add(String(i));
    write(key, [...next].join(","));
  };

  return (
    <fieldset className="max-w-[68ch] space-y-3 rounded-lg border p-4">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-brand">Jelasin balik</legend>
      <p className="text-sm font-medium">{prompt}</p>
      <p className="text-sm text-muted-foreground">Jawab dengan suara keras dulu, lalu centang poin yang sudah kamu sebut.</p>
      <ul className="space-y-2">
        {rubric.map((item, i) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <input id={`${uid}-${i}`} type="checkbox" checked={ticked.has(String(i))} onChange={() => toggle(i)} className="mt-1 size-4 accent-[var(--brand)]" />
            <label htmlFor={`${uid}-${i}`}>{item}</label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
