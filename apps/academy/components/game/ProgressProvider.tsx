"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { XpEvent } from "@/lib/course/types";
import type { AwardResult, ProgressState } from "@/lib/game/award";
import { BADGES } from "./badges";
import { ReauthDialog } from "./ReauthDialog";

/** Thrown by send() for any non-401 failure; `body` holds the server JSON (e.g. {score,total,passed:false} on 422). */
export class ProgressError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`progress request failed (${status})`);
  }
}

type Ctx = {
  state: ProgressState;
  send(e: XpEvent): Promise<AwardResult | "unauthorized">;
  isDone(ref: string): boolean;
  /** Increments after a successful in-place re-login so callers can retry what returned "unauthorized". */
  reauthCount: number;
  /** Re-opens the re-login dialog (e.g. after it was dismissed while an event is still parked). */
  openReauth(): void;
};

const ProgressCtx = createContext<Ctx | null>(null);

export function useProgress(): Ctx {
  const ctx = useContext(ProgressCtx);
  if (!ctx) throw new Error("useProgress must be used inside <ProgressProvider>");
  return ctx;
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function ProgressProvider({ initial, children }: { initial: ProgressState; children: React.ReactNode }) {
  const [state, setState] = useState(initial);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthCount, setReauthCount] = useState(0);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/progress?tz=${encodeURIComponent(tz())}`);
      if (res.ok) setState(await res.json());
    } catch {
      // keep the server-rendered state
    }
  }, []);

  // The server renders with UTC; replace it with the learner's timezone (streaks) once mounted.
  useEffect(() => {
    let live = true;
    fetch(`/api/progress?tz=${encodeURIComponent(tz())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => live && s && setState(s))
      .catch(() => {}); // keep the server-rendered state
    return () => {
      live = false;
    };
  }, []);

  const send = useCallback(async (event: XpEvent): Promise<AwardResult | "unauthorized"> => {
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, tz: tz() }),
    });
    if (res.status === 401) {
      setReauthOpen(true);
      return "unauthorized";
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ProgressError(res.status, body);
    const result = body as AwardResult;
    const { gained, newBadges, ...next } = result;
    setState(next);
    if (gained > 0) toast(`+${gained} XP`);
    for (const id of newBadges) {
      const b = BADGES.find((x) => x.id === id);
      if (b) toast(`Badge didapat: ${b.title}`, { description: b.hint });
    }
    return result;
  }, []);

  const openReauth = useCallback(() => setReauthOpen(true), []);

  const value = useMemo<Ctx>(() => {
    const done = new Set(state.completed);
    return { state, send, isDone: (ref) => done.has(ref), reauthCount, openReauth };
  }, [state, send, reauthCount, openReauth]);

  return (
    <ProgressCtx.Provider value={value}>
      {children}
      <ReauthDialog
        open={reauthOpen}
        onOpenChange={setReauthOpen}
        onSuccess={() => {
          setReauthCount((n) => n + 1);
          void refetch();
        }}
      />
    </ProgressCtx.Provider>
  );
}
