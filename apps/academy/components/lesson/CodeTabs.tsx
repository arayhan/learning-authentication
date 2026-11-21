import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { highlight } from "./highlight";
import { parseSpec, readSnippet } from "./snippet";

/**
 * Go and TypeScript side by side. Paths are repo-relative with an optional #L10-L42 range. `notes` is keyed by the
 * file's own line number and shown as numbered markers plus a list. Missing files (labs not built yet) render a placeholder.
 */
export async function CodeTabs({ go, ts, notes = {} }: { go?: string; ts?: string; notes?: Record<number, string> }) {
  const tabs = [
    { key: "go", label: "Go", spec: go },
    { key: "ts", label: "TypeScript", spec: ts },
  ].flatMap((t) => (t.spec ? [{ ...t, spec: t.spec }] : []));

  const panels = await Promise.all(
    tabs.map(async ({ key, label, spec }) => {
      const snip = await readSnippet(spec);
      if (!snip.ok) return { key, label, spec, snip, html: "", lines: [] as [number, string][] };
      const end = snip.startLine + snip.code.split("\n").length - 1;
      const lines = Object.entries(notes)
        .map(([l, text]) => [Number(l), text] as [number, string])
        .filter(([l]) => l >= snip.startLine && l <= end)
        .sort((a, b) => a[0] - b[0]);
      const html = await highlight(snip.code, snip.lang, snip.startLine, new Map(lines.map(([l], i) => [l, i + 1])));
      return { key, label, spec, snip, html, lines };
    }),
  );
  if (panels.length === 0) return null;

  return (
    <Tabs defaultValue={panels[0].key} className="max-w-3xl min-w-0">
      <TabsList variant="line">
        {panels.map((p) => (
          <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>
        ))}
      </TabsList>
      {panels.map((p) => (
        <TabsContent key={p.key} value={p.key} className="min-w-0 space-y-3">
          <p className="truncate font-mono text-xs text-muted-foreground">{parseSpec(p.spec).file}</p>
          {p.snip.ok ? (
            <>
              <div
                className="code-block overflow-x-auto rounded-lg border bg-muted/30 py-3 text-[13px] leading-6"
                style={{ counterReset: `line ${p.snip.startLine - 1}` }}
                dangerouslySetInnerHTML={{ __html: p.html }}
              />
              {p.lines.length > 0 && (
                <ol className="space-y-1 text-sm">
                  {p.lines.map(([l, text], i) => (
                    <li key={l} className="flex gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-primary-foreground">{i + 1}</span>
                      <span><span className="font-mono text-xs text-muted-foreground">line {l}</span> {text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Source not available yet: <span className="font-mono">{p.snip.path}</span>
            </p>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
