"use client";

import { createContext, useContext } from "react";
import { getLesson } from "@/lib/course/registry";
import type { LessonMeta } from "@/lib/course/types";

const LessonCtx = createContext<string | null>(null);

/** Gives MDX components the lesson id. Pass the id only: LessonMeta holds functions and cannot cross the server/client boundary. */
export function LessonProvider({ lessonId, children }: { lessonId: string; children: React.ReactNode }) {
  return <LessonCtx.Provider value={lessonId}>{children}</LessonCtx.Provider>;
}

export function useLesson(): LessonMeta {
  const id = useContext(LessonCtx);
  if (!id) throw new Error("Lesson components must be rendered inside <LessonProvider>");
  const lesson = getLesson(id);
  if (!lesson) throw new Error(`Unknown lesson "${id}"`);
  return lesson;
}
