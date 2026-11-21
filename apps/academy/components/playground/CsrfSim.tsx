"use client";

import { Check, Circle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useProgress } from "@/components/game/ProgressProvider";
import { useSender } from "@/components/lesson/useSender";
import { Button } from "@/components/ui/button";

const REF = "m1-l5/csrf";
type Defense = "lax" | "token" | "origin";
type Toggles = Record<Defense, boolean>;

const DEFENSES: { id: Defense; label: string; hint: string }[] = [
  { id: "lax", label: "SameSite=Lax", hint: "Browser nggak ngirim cookie di POST cross-site." },
  { id: "token", label: "CSRF token", hint: "Server minta header rahasia yang cuma diketahui halamannya sendiri." },
  { id: "origin", label: "Origin check", hint: "Server nolak POST yang Origin-nya bukan bank.localhost." },
];

/** What the bank sees when evil.example auto-submits a form, and what it answers. Same order of checks as the lab. */
function forge(t: Toggles) {
  const cookieSent = !t.lax;
  const req = {
    cookie: cookieSent ? "sid=9f2c… (sent)" : "none (ditahan oleh SameSite=Lax)",
    origin: "http://evil.example",
    token: "missing (evil.example nggak bisa baca)",
  };
  if (!cookieSent) return { req, status: 401, blocked: true, why: "Cookie nggak pernah terkirim, jadi bank melihat ini sebagai request anonim." };
  if (t.token) return { req, status: 403, blocked: true, why: "Nggak ada header X-CSRF-Token, dan attacker nggak bisa baca yang asli." };
  if (t.origin) return { req, status: 403, blocked: true, why: "Header Origin bilang evil.example, bukan bank.localhost." };
  return { req, status: 200, blocked: false, why: "Browser menempelkan cookie, dan nggak ada lagi yang nanya siapa pengirim request-nya." };
}

// The one-defense-at-a-time view is what proves each defense works on its own.
const observation = (t: Toggles): string | null => {
  const on = DEFENSES.filter((d) => t[d.id]);
  return on.length === 0 ? "none" : on.length === 1 ? on[0].id : null;
};

const GOALS = [
  { key: "none", label: "Forged request berhasil kalau semua defense mati" },
  { key: "lax", label: "Diblokir oleh SameSite=Lax saja" },
  { key: "token", label: "Diblokir oleh CSRF token saja" },
  { key: "origin", label: "Diblokir oleh Origin check saja" },
];

/** Two mini browser windows and three defenses. No network: everything is simulated here. */
export function CsrfSim() {
  const [t, setT] = useState<Toggles>({ lax: false, token: false, origin: false });
  const [result, setResult] = useState<ReturnType<typeof forge> | null>(null);
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const { isDone } = useProgress();
  const sent = useRef(false);
  const { fire, busy, awaitingLogin, openReauth } = useSender((o) => {
    if (!o.ok) sent.current = false;
  });

  const complete = GOALS.every((g) => seen.has(g.key));
  useEffect(() => {
    if (!complete || sent.current || isDone(REF)) return;
    sent.current = true;
    void fire({ kind: "attack", ref: REF });
  }, [complete, isDone, fire]);

  const toggle = (id: Defense) => {
    setT((s) => ({ ...s, [id]: !s[id] }));
    setResult(null);
  };
  const send = () => {
    const r = forge(t);
    setResult(r);
    const key = observation(t);
    // "none" only counts when the request really went through; a defense only counts when it really blocked.
    if (key && r.blocked === (key !== "none")) setSeen((s) => new Set(s).add(key));
  };

  return (
    <div className="max-w-3xl space-y-4 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Simulator CSRF</h3>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Defense bank</legend>
        {DEFENSES.map((d) => (
          <label key={d.id} className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={t[d.id]} onChange={() => toggle(d.id)} className="mt-1 size-4 accent-[var(--brand)]" />
            <span>
              <span className="font-mono text-xs font-medium">{d.label}</span>
              <span className="block text-xs text-muted-foreground">{d.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <section aria-label="Jendela evil.example" className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="truncate rounded border bg-background px-2 py-1 font-mono text-xs">https://evil.example/free-cruise</p>
          <p className="text-sm font-medium">Menangkan cruise gratis!</p>
          <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-[11px] leading-5">{`<form method="POST"
  action="http://bank.localhost/transfer">
  <input name="to" value="mallory">
  <input name="amount" value="500">
</form>
<script>form.submit()</script>`}</pre>
        </section>
        <section aria-label="Jendela bank.localhost" className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="truncate rounded border bg-background px-2 py-1 font-mono text-xs">http://bank.localhost</p>
          <p className="text-sm font-medium">Login sebagai sam</p>
          <p className="font-mono text-xs text-muted-foreground">balance: {result && !result.blocked ? "$500 (tadinya $1,000)" : "$1,000"}</p>
          <p className="font-mono text-[11px] text-muted-foreground">cookie jar: sid=9f2c… ({t.lax ? "SameSite=Lax" : "tanpa SameSite"})</p>
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        Chrome modern memperlakukan cookie tanpa atribut SameSite sebagai Lax secara default, jadi &quot;tanpa SameSite&quot; di sini mewakili browser lama atau SameSite=None yang eksplisit.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={send}>Kirim forged request</Button>
        <span className="text-xs text-muted-foreground">Korban sudah login di bank dan barusan buka halaman jahat itu.</span>
      </div>

      {result && (
        <output aria-label="Hasil" className={`block space-y-2 rounded-md border p-3 text-sm ${result.blocked ? "border-success/40" : "border-destructive/50"}`}>
          <p className="font-semibold">
            {result.blocked ? `Forged request diblokir (${result.status})` : `Forged request berhasil (${result.status}): $500 pindah ke mallory`}
          </p>
          <p className="text-muted-foreground">{result.why}</p>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-muted-foreground">{`POST /transfer HTTP/1.1
Host: bank.localhost
Origin: ${result.req.origin}
Cookie: ${result.req.cookie}
X-CSRF-Token: ${result.req.token}`}</pre>
        </output>
      )}

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Coba tiap kasus, satu defense per percobaan</p>
        <ul className="space-y-1">
          {GOALS.map((g) => (
            <li key={g.key} className="flex items-center gap-2 text-sm">
              {seen.has(g.key) ? <Check aria-hidden className="size-4 text-success" /> : <Circle aria-hidden className="size-4 text-muted-foreground" />}
              <span className={seen.has(g.key) ? "text-muted-foreground line-through" : undefined}>{g.label}</span>
              <span className="sr-only">{seen.has(g.key) ? "(selesai)" : "(belum)"}</span>
            </li>
          ))}
        </ul>
        {(complete || isDone(REF)) && !awaitingLogin && <p className="mt-2 text-sm font-medium">Attack selesai.</p>}
        {awaitingLogin && (
          <div className="mt-2 flex items-center gap-2">
            <p role="status" className="text-sm text-muted-foreground">Login lagi buat nyimpen progress kamu.</p>
            <Button variant="outline" size="sm" disabled={busy} onClick={openReauth}>Login lagi</Button>
          </div>
        )}
      </div>
    </div>
  );
}
