import { Info, ShieldAlert, TriangleAlert } from "lucide-react";

const TYPES = {
  info: { Icon: Info, label: "Catatan", style: "border-l-brand" },
  warn: { Icon: TriangleAlert, label: "Awas", style: "border-l-amber-500" },
  security: { Icon: ShieldAlert, label: "Keamanan", style: "border-l-destructive" },
} as const;

export function Callout({ type = "info", children }: { type?: keyof typeof TYPES; children: React.ReactNode }) {
  const { Icon, label, style } = TYPES[type];
  return (
    <aside role="note" aria-label={label} className={`flex max-w-[68ch] gap-3 rounded-lg border border-l-4 bg-muted/30 p-4 text-sm ${style}`}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-2 [&>p]:max-w-none">{children}</div>
    </aside>
  );
}
