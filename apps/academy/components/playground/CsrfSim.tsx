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
  { id: "lax", label: "SameSite=Lax", hint: "The browser withholds the cookie on cross-site POSTs." },
  { id: "token", label: "CSRF token", hint: "The server wants a secret header that only its own pages know." },
  { id: "origin", label: "Origin check", hint: "The server rejects a POST whose Origin is not bank.localhost." },
];

/** What the bank sees when evil.example auto-submits a form, and what it answers. Same order of checks as the lab. */
function forge(t: Toggles) {
  const cookieSent = !t.lax;
  const req = {
    cookie: cookieSent ? "sid=9f2c… (sent)" : "none (withheld by SameSite=Lax)",
    origin: "http://evil.example",
    token: "missing (evil.example cannot read it)",
  };
  if (!cookieSent) return { req, status: 401, blocked: true, why: "The cookie was never sent, so the bank sees an anonymous request." };
  if (t.token) return { req, status: 403, blocked: true, why: "No X-CSRF-Token header, and the attacker cannot read the real one." };
  if (t.origin) return { req, status: 403, blocked: true, why: "The Origin header says evil.example, not bank.localhost." };
  return { req, status: 200, blocked: false, why: "The browser attached the cookie, and nothing else asked who sent the request." };
}

// The one-defense-at-a-time view is what proves each defense works on its own.
const observation = (t: Toggles): string | null => {
  const on = DEFENSES.filter((d) => t[d.id]);
  return on.length === 0 ? "none" : on.length === 1 ? on[0].id : null;
};

const GOALS = [
  { key: "none", label: "Forged request succeeds with every defense off" },
  { key: "lax", label: "Blocked by SameSite=Lax alone" },
  { key: "token", label: "Blocked by the CSRF token alone" },
  { key: "origin", label: "Blocked by the Origin check alone" },
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
      <h3 className="text-sm font-semibold">CSRF simulator</h3>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Bank defenses</legend>
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
        <section aria-label="evil.example window" className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="truncate rounded border bg-background px-2 py-1 font-mono text-xs">https://evil.example/free-cruise</p>
          <p className="text-sm font-medium">Win a free cruise!</p>
          <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-[11px] leading-5">{`<form method="POST"
  action="http://bank.localhost/transfer">
  <input name="to" value="mallory">
  <input name="amount" value="500">
</form>
<script>form.submit()</script>`}</pre>
        </section>
        <section aria-label="bank.localhost window" className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="truncate rounded border bg-background px-2 py-1 font-mono text-xs">http://bank.localhost</p>
          <p className="text-sm font-medium">Signed in as sam</p>
          <p className="font-mono text-xs text-muted-foreground">balance: {result && !result.blocked ? "$500 (was $1,000)" : "$1,000"}</p>
          <p className="font-mono text-[11px] text-muted-foreground">cookie jar: sid=9f2c… ({t.lax ? "SameSite=Lax" : "no SameSite"})</p>
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        Modern Chrome treats a cookie with no SameSite attribute as Lax by default, so &quot;no SameSite&quot; here models older browsers or an explicit SameSite=None.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={send}>Send forged request</Button>
        <span className="text-xs text-muted-foreground">The victim is signed in at the bank and just opened the evil page.</span>
      </div>

      {result && (
        <output aria-label="Result" className={`block space-y-2 rounded-md border p-3 text-sm ${result.blocked ? "border-success/40" : "border-destructive/50"}`}>
          <p className="font-semibold">
            {result.blocked ? `Forged request blocked (${result.status})` : `Forged request succeeded (${result.status}): $500 moved to mallory`}
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
        <p className="mb-1 text-xs font-medium text-muted-foreground">Try each case, one defense at a time</p>
        <ul className="space-y-1">
          {GOALS.map((g) => (
            <li key={g.key} className="flex items-center gap-2 text-sm">
              {seen.has(g.key) ? <Check aria-hidden className="size-4 text-success" /> : <Circle aria-hidden className="size-4 text-muted-foreground" />}
              <span className={seen.has(g.key) ? "text-muted-foreground line-through" : undefined}>{g.label}</span>
              <span className="sr-only">{seen.has(g.key) ? "(done)" : "(not done)"}</span>
            </li>
          ))}
        </ul>
        {(complete || isDone(REF)) && !awaitingLogin && <p className="mt-2 text-sm font-medium">Attack complete.</p>}
        {awaitingLogin && (
          <div className="mt-2 flex items-center gap-2">
            <p role="status" className="text-sm text-muted-foreground">Sign in again to save your progress.</p>
            <Button variant="outline" size="sm" disabled={busy} onClick={openReauth}>Sign in again</Button>
          </div>
        )}
      </div>
    </div>
  );
}
