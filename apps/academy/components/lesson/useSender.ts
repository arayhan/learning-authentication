"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProgressError, useProgress } from "@/components/game/ProgressProvider";
import type { XpEvent } from "@/lib/course/types";
import type { AwardResult } from "@/lib/game/award";

export type Outcome = { ok: true; result: AwardResult } | { ok: false; error: ProgressError | Error };

/**
 * Sends one XP event at a time. On 401 the event is parked and re-sent when `reauthCount` increments
 * (the provider opens the re-login dialog), so nothing the learner did is lost.
 */
export function useSender(onOutcome: (o: Outcome) => void) {
  const { send, reauthCount, openReauth } = useProgress();
  const [busy, setBusy] = useState(false);
  const [awaitingLogin, setAwaitingLogin] = useState(false);
  const parked = useRef<XpEvent | null>(null);
  const seen = useRef(reauthCount);
  const handler = useRef(onOutcome);
  useEffect(() => {
    handler.current = onOutcome;
  });

  const run = useCallback(
    async (event: XpEvent) => {
      setBusy(true);
      try {
        const r = await send(event);
        parked.current = r === "unauthorized" ? event : null;
        setAwaitingLogin(r === "unauthorized");
        if (r !== "unauthorized") handler.current({ ok: true, result: r });
      } catch (e) {
        parked.current = null;
        setAwaitingLogin(false);
        handler.current({ ok: false, error: e instanceof Error ? e : new Error(String(e)) });
      } finally {
        setBusy(false);
      }
    },
    [send],
  );

  useEffect(() => {
    if (reauthCount === seen.current) return;
    seen.current = reauthCount;
    if (parked.current) void run(parked.current);
  }, [reauthCount, run]);

  return { fire: (event: XpEvent) => (busy ? Promise.resolve() : run(event)), busy, awaitingLogin, openReauth };
}
