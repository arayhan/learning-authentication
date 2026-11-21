"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { Impl } from "@/lib/labs";

const KEY = "academy:lab-impl";
const listeners = new Set<() => void>();

const read = (): Impl => {
  try {
    return localStorage.getItem(KEY) === "ts" ? "ts" : "go";
  } catch {
    return "go";
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

type Ctx = [Impl, (impl: Impl) => void];
const LabImplCtx = createContext<Ctx | null>(null);

/** Selected lab implementation, persisted in localStorage. Go on the server render, then follows storage. */
export function LabImplProvider({ children }: { children: React.ReactNode }) {
  const impl = useSyncExternalStore(subscribe, read, () => "go" as Impl);
  const set = useCallback((next: Impl) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    listeners.forEach((f) => f());
  }, []);
  const value = useMemo<Ctx>(() => [impl, set], [impl, set]);
  return <LabImplCtx.Provider value={value}>{children}</LabImplCtx.Provider>;
}

export function useLabImpl(): Ctx {
  const ctx = useContext(LabImplCtx);
  if (!ctx) throw new Error("useLabImpl must be used inside <LabImplProvider>");
  return ctx;
}
