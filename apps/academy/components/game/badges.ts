import type { BadgeId } from "@/lib/course/types";

export const BADGES: { id: BadgeId; title: string; hint: string }[] = [
  { id: "cookie-monster", title: "Cookie Monster", hint: "Finish Module 1" },
  { id: "token-smith", title: "Token Smith", hint: "Finish Module 2" },
  { id: "code-verifier", title: "Code Verifier", hint: "Finish Module 3" },
  { id: "red-team", title: "Red Team", hint: "Complete every attack" },
  { id: "on-call", title: "On Call", hint: "7-day streak" },
  { id: "flawless", title: "Flawless", hint: "100% on a boss" },
];
