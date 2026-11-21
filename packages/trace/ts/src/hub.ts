import type { TraceEvent } from "./types";

export type Hub = {
  publish(e: TraceEvent): void;
  recent(): TraceEvent[];
  subscribe(fn: (e: TraceEvent) => void): () => void;
};

export function createHub(capacity = 200): Hub {
  const buf: TraceEvent[] = [];
  const subs = new Set<(e: TraceEvent) => void>();
  return {
    publish(e) {
      buf.push(e);
      if (buf.length > capacity) buf.shift();
      for (const fn of [...subs]) {
        try { fn(e); } catch { /* a broken subscriber must not break publish */ }
      }
    },
    recent: () => [...buf],
    subscribe(fn) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
  };
}
