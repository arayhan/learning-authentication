import { Flame } from "lucide-react";

export function StreakChip({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
      <Flame className="size-3.5" aria-hidden />
      <span><span className="font-mono tabular-nums">{days}</span>-hari streak</span>
    </span>
  );
}
