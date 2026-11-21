import { course, moduleRefs } from "@/lib/course/registry";
import type { BadgeId } from "@/lib/course/types";

export function evaluateBadges(s: { completed: Set<string>; perfectBoss: boolean; streak: number }): BadgeId[] {
  const out: BadgeId[] = course.filter((m) => moduleRefs(m).every((r) => s.completed.has(r))).map((m) => m.badge);
  const attacks = course.flatMap((m) => m.lessons.flatMap((l) => l.attacks.map((a) => `${l.id}/${a.id}`)));
  if (attacks.length > 0 && attacks.every((r) => s.completed.has(r))) out.push("red-team");
  if (s.streak >= 7) out.push("on-call");
  if (s.perfectBoss) out.push("flawless");
  return out;
}
