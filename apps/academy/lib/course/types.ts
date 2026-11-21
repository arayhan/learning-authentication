// TODO(task-8): import from @academy/trace
export type TraceEvent = {
  id: string; ts: string; lab: "01" | "02" | "03"; impl: "go" | "ts"; role: "app" | "as" | "client" | "api";
  req: { method: string; path: string; query: string; headers: Record<string, string>; body?: string };
  res: { status: number; headers: Record<string, string | string[]>; body?: string };
  durationMs: number;
};

export type ModuleId = "m1" | "m2" | "m3";
export type LabId = "01" | "02" | "03";
export type BadgeId = "cookie-monster" | "token-smith" | "code-verifier" | "red-team" | "on-call" | "flawless";

export type QuizQuestion = { prompt: string; choices: string[]; answer: number; why: string };
export type Quiz = { id: string; questions: QuizQuestion[]; boss?: { seconds: number; passRatio: number } };
export type LabTask = { id: string; label: string; lab: LabId; hint: string; match: (e: TraceEvent) => boolean };
export type Attack = { id: string; title: string; kind: "live" | "simulated" };
export type LessonMeta = {
  id: string; module: ModuleId; slug: string; title: string; minutes: number;
  steps: { id: string; title: string }[]; quizzes: Quiz[]; labTasks: LabTask[]; attacks: Attack[];
};
export type CourseModule = {
  id: ModuleId; slug: string; title: string; summary: string; badge: BadgeId; lessons: LessonMeta[];
};

export type XpEvent =
  | { kind: "step"; ref: string }
  | { kind: "quiz"; ref: string; answers: number[] }
  | { kind: "lab-task"; ref: string }
  | { kind: "attack"; ref: string }
  | { kind: "boss"; ref: string; answers: number[]; elapsedMs: number };
