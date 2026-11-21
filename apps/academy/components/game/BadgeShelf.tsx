import { Award, Lock } from "lucide-react";
import type { BadgeId } from "@/lib/course/types";
import { BADGES } from "./badges";

export function BadgeShelf({ earned }: { earned: readonly BadgeId[] }) {
  const have = new Set(earned);
  return (
    <section aria-labelledby="badges-h" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="badges-h" className="text-sm font-medium">Badges</h2>
        <span className="text-xs text-muted-foreground">{have.size} / {BADGES.length} earned</span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BADGES.map((b) => {
          const got = have.has(b.id);
          return (
            <li
              key={b.id}
              data-badge={b.id}
              data-earned={got}
              className={`rounded-lg border p-3 ${got ? "" : "border-dashed text-muted-foreground"}`}
            >
              {got ? <Award className="size-4 text-brand" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              <p className="mt-2 text-sm font-medium">{b.title}</p>
              <p className="text-xs text-muted-foreground">{b.hint}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
