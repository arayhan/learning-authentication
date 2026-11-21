const ROWS: [string, number][] = [
  ["Lesson step", 10],
  ["Quiz pass", 20],
  ["Lab task", 15],
  ["Attack", 30],
  ["Boss pass", 100],
];

/** Static reference for the dashboard's right pane. */
export function XpGuide() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">XP is awarded once per activity.</p>
      <dl className="divide-y text-sm">
        {ROWS.map(([k, v]) => (
          <div key={k} className="flex justify-between py-2">
            <dt>{k}</dt>
            <dd className="font-mono tabular-nums text-muted-foreground">+{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
