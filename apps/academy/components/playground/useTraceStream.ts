"use client";

import { useCallback, useEffect, useState } from "react";
import type { LabId, TraceEvent } from "@/lib/course/types";
import { labs, type Impl } from "@/lib/labs";

export type TraceStatus = "connecting" | "online" | "offline";
type State = { key: string; status: TraceStatus; events: TraceEvent[] };

const CAP = 200;
const RETRY_MS = 3000;

/**
 * Subscribes to a lab's SSE trace. Events are newest-last, capped at 200 and deduped by id
 * (the server replays recent events on every reconnect). Goes offline on error and retries every 3s.
 */
export function useTraceStream(lab: LabId, impl: Impl): { status: TraceStatus; events: TraceEvent[]; clear(): void } {
  const key = `${lab}:${impl}`;
  const [state, setState] = useState<State>({ key, status: "connecting", events: [] });

  useEffect(() => {
    const url = labs[lab].traceUrl(impl);
    const seen = new Set<string>();
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const update = (f: (s: State) => Partial<State>) =>
      setState((s) => {
        const base = s.key === key ? s : { key, status: "connecting" as const, events: [] };
        return { ...base, ...f(base) };
      });

    const connect = () => {
      const source = new EventSource(url);
      es = source;
      source.onopen = () => update(() => ({ status: "online" }));
      source.onmessage = (m) => {
        let e: TraceEvent;
        try {
          e = JSON.parse(m.data);
        } catch {
          return;
        }
        if (!e || typeof e.id !== "string" || seen.has(e.id)) return;
        seen.add(e.id);
        if (seen.size > CAP * 5) seen.delete(seen.values().next().value as string);
        update((s) => ({ events: [...s.events, e].slice(-CAP) }));
      };
      source.onerror = () => {
        source.close();
        if (stopped) return;
        update(() => ({ status: "offline" }));
        timer = setTimeout(connect, RETRY_MS);
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      es?.close();
    };
  }, [lab, impl, key]);

  const clear = useCallback(() => setState((s) => ({ ...s, events: [] })), []);
  const cur = state.key === key ? state : { status: "connecting" as const, events: [] };
  return { status: cur.status, events: cur.events, clear };
}
