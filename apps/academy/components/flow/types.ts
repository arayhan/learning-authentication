export type Actor = { id: string; label: string; kind: "user" | "browser" | "server" | "db" | "attacker" | "as" | "api" };
export type FlowStep = { from: string; to: string; label: string; http?: string; note?: string; danger?: boolean };
export type Flow = { id: string; title: string; actors: Actor[]; steps: FlowStep[] };
