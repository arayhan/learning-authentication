import type { BadgeId } from "@/lib/course/types";

export const BADGES: { id: BadgeId; title: string; hint: string }[] = [
  { id: "cookie-monster", title: "Cookie Monster", hint: "Selesaikan Module 1" },
  { id: "token-smith", title: "Token Smith", hint: "Selesaikan Module 2" },
  { id: "code-verifier", title: "Code Verifier", hint: "Selesaikan Module 3" },
  { id: "red-team", title: "Red Team", hint: "Selesaikan semua attack" },
  { id: "on-call", title: "On Call", hint: "Streak 7 hari" },
  { id: "flawless", title: "Flawless", hint: "Nilai 100% di boss" },
];
