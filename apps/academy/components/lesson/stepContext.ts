"use client";

import { createContext, useContext, useEffect, useLayoutEffect } from "react";

export type StepInfo = { index: number; done: boolean; last: boolean };
export const StepCtx = createContext<StepInfo | null>(null);

/** Lets a gated quiz tell its enclosing Step that Continue must wait for it. Returns an unregister fn. */
export const GateCtx = createContext<((quizId: string) => () => void) | null>(null);

// Layout effect so Continue is never enabled for a painted frame; plain effect on the server.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Register `quizId` as a gate of the enclosing Step while `gate` is set. */
export function useGate(quizId: string, gate: boolean) {
  const register = useContext(GateCtx);
  useIsoLayoutEffect(() => (gate && register ? register(quizId) : undefined), [gate, register, quizId]);
}
