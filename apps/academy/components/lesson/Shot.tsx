import Image from "next/image";

/** Browser-framed screenshot from /public. Callout markers use x/y in percent; the numbered list below is the accessible version. */
export function Shot({
  src,
  alt,
  caption,
  callouts = [],
}: {
  src: string;
  alt: string;
  caption?: string;
  callouts?: { x: number; y: number; label: string }[];
}) {
  return (
    <figure className="max-w-3xl space-y-3">
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center gap-1.5 border-b bg-muted/50 px-3 py-2" aria-hidden>
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </div>
        <div className="relative aspect-video">
          <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 768px, 100vw" className="object-cover object-top" />
          {callouts.map((c, i) => (
            <span
              key={c.label}
              aria-hidden
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
              className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-xs font-semibold text-primary-foreground ring-2 ring-background"
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>
      {callouts.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {callouts.map((c) => (
            <li key={c.label}>{c.label}</li>
          ))}
        </ol>
      )}
      {caption && <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
