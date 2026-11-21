import { Progress } from "@/components/ui/progress";

export function XpBar({ xp, level }: { xp: number; level: { name: string; min: number; next: number | null } }) {
  const into = xp - level.min;
  const span = level.next === null ? Math.max(into, 1) : level.next - level.min;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{level.name}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {xp} XP{level.next !== null && ` / ${level.next}`}
        </span>
      </div>
      <Progress value={into} min={0} max={span} aria-label={`Progress XP di level ${level.name}`} />
    </div>
  );
}
