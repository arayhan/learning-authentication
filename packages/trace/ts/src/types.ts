export type TraceEvent = {
  id: string; ts: string; lab: "01" | "02" | "03"; impl: "go" | "ts"; role: "app" | "as" | "client" | "api";
  req: { method: string; path: string; query: string; headers: Record<string, string>; body?: string };
  res: { status: number; headers: Record<string, string | string[]>; body?: string };
  durationMs: number;
};
