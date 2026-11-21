/** A short real-world comparison (3 sentences max by house style). */
export function Analogy({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className="max-w-[68ch] rounded-lg border bg-muted/30 p-4">
      <figcaption className="mb-1 text-xs font-medium uppercase tracking-wide text-brand">Analogi: {title}</figcaption>
      <div className="space-y-2 text-sm [&>p]:max-w-none">{children}</div>
    </figure>
  );
}
