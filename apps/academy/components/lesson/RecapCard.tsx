/** End-of-lesson summary plus interview-style questions that reveal their answer on demand. */
export function RecapCard({ bullets, interview = [] }: { bullets: string[]; interview?: { q: string; a: string }[] }) {
  return (
    <div className="max-w-[68ch] space-y-5 rounded-lg border p-5">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Poin penting</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
      {interview.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Cek wawancara</h3>
          <div className="divide-y rounded-lg border">
            {interview.map(({ q, a }) => (
              <details key={q} className="group px-3 py-2 text-sm">
                <summary className="cursor-pointer list-none font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  {q}
                </summary>
                <p className="mt-2 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
