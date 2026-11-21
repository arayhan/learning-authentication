const ROWS: [string, number][] = [
  ["Langkah lesson", 10],
  ["Lulus quiz", 20],
  ["Task lab", 15],
  ["Attack", 30],
  ["Lulus boss", 100],
];

/** Static reference for the dashboard's right pane. */
export function XpGuide() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">XP cuma dikasih sekali per aktivitas.</p>
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
