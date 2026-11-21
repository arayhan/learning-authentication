"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useProgress } from "@/components/game/ProgressProvider";
import { useSender } from "@/components/lesson/useSender";
import { Button } from "@/components/ui/button";
import { labBase, type Impl } from "@/lib/labs";
import { useLabImpl } from "./LabImpl";
import { OfflineCard } from "./OfflineCard";

type Attack = { id: string; mode: string; title: string; forged: string; secureWhy: string; vulnerableWhy: string };

const ATTACKS: Attack[] = [
  {
    id: "alg-none",
    mode: "none",
    title: "alg: none",
    forged: 'Header {"alg":"none"}, claims sub=forged-user, and no signature at all.',
    secureWhy: "The secure verifier pins RS256, so a token that says none is rejected before anything else is checked.",
    vulnerableWhy: "The vulnerable verifier lets the token pick its own algorithm. It chose none, so no signature was needed.",
  },
  {
    id: "key-confusion",
    mode: "hs256-with-public-key",
    title: "RS256 to HS256 key confusion",
    forged: "Header alg HS256, signed with HMAC using the server's PUBLIC key text as the secret. The public key is public, so anyone can do that.",
    secureWhy: "The secure verifier only ever treats the key as an RSA public key and only accepts RS256, so an HMAC token never verifies.",
    vulnerableWhy: "The vulnerable verifier switched to HMAC because the header said so, and used the public key as the secret.",
  },
  {
    id: "expired",
    mode: "expired",
    title: "Expired token",
    forged: "A genuinely signed RS256 token whose exp was an hour ago.",
    secureWhy: "The secure verifier requires exp and rejects a token past it.",
    vulnerableWhy: "The vulnerable verifier checks the signature but never looks at exp (or aud, or iss).",
  },
];

type Run = { step: number; token?: string; secure?: { status: number; body: string }; vulnerable?: { status: number; body: string } };
const STEPS = ["Ask the lab to forge the token", "Present it to the secure verifier", "Present it to the vulnerable verifier"];

/**
 * Three live attacks on the selected lab 02 implementation. Each card forges a token, then sends the same token to
 * /api/profile twice: once normally, once with X-Lab-Mode: vulnerable. The attack event is only sent for a card
 * after it saw secure 401 and vulnerable 200.
 */
export function JwtAttackLab() {
  const [impl] = useLabImpl();
  const [offline, setOffline] = useState(false);
  return (
    <div className="max-w-3xl space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">JWT attacks, live</h3>
        <p className="text-xs text-muted-foreground">
          Runs against the lab at {labBase("02", impl)}. Open the Inspector to watch every request. No account is needed: the forged tokens never touch a real user.
        </p>
      </div>
      {/* retrying={false}: nothing polls here, the learner just clicks Run again once the lab is up. */}
      {offline && <OfflineCard lab="02" impl={impl} retrying={false} />}
      <div className="space-y-3">
        {ATTACKS.map((a) => (
          <AttackCard key={a.id} attack={a} impl={impl} onOffline={setOffline} />
        ))}
      </div>
    </div>
  );
}

function AttackCard({ attack, impl, onOffline }: { attack: Attack; impl: Impl; onOffline: (v: boolean) => void }) {
  const ref = `m2-l5/${attack.id}`;
  const { isDone } = useProgress();
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const sent = useRef(false);
  const { fire, busy, awaitingLogin, openReauth } = useSender((o) => {
    if (!o.ok) sent.current = false;
  });

  const expected = run?.secure?.status === 401 && run.vulnerable?.status === 200;
  useEffect(() => {
    if (!expected || sent.current || isDone(ref)) return;
    sent.current = true;
    void fire({ kind: "attack", ref });
  }, [expected, isDone, fire, ref]);

  const go = async () => {
    const base = labBase("02", impl);
    const call = async (path: string, init: { method: string; headers: Record<string, string>; body?: string }) => fetch(`${base}${path}`, { ...init, credentials: "include" });
    const profile = async (token: string, vulnerable: boolean) => {
      const res = await call("/api/profile", { method: "GET", headers: { Authorization: `Bearer ${token}`, ...(vulnerable ? { "X-Lab-Mode": "vulnerable" } : {}) } });
      return { status: res.status, body: await res.text() };
    };
    setRunning(true);
    setError(null);
    onOffline(false);
    try {
      setRun({ step: 0 });
      // /__attack/sign exists only in vulnerable mode, for every run: the forgery helper is not part of the secure API.
      const sign = await call("/__attack/sign", { method: "POST", headers: { "Content-Type": "application/json", "X-Lab-Mode": "vulnerable" }, body: JSON.stringify({ mode: attack.mode }) });
      const { token } = (await sign.json().catch(() => ({}))) as { token?: string };
      if (!sign.ok || !token) {
        setRun(null);
        return setError(`The lab refused to forge the token (${sign.status}). Restart the lab.`);
      }
      setRun({ step: 1, token });
      const secure = await profile(token, false);
      setRun({ step: 2, token, secure });
      const vulnerable = await profile(token, true);
      setRun({ step: 3, token, secure, vulnerable });
    } catch {
      setRun(null);
      onOffline(true);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section aria-label={attack.title} className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{attack.title}</p>
        <p className="text-xs text-muted-foreground">{attack.forged}</p>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {run && (
        <ol className="space-y-1.5 text-xs">
          {STEPS.map((label, i) => {
            const done = run.step > i;
            const active = running && run.step === i;
            return (
              <li key={label} className="flex items-start gap-2">
                {done ? <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" /> : active ? <Loader2 aria-hidden className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" /> : <span aria-hidden className="mt-0.5 size-3.5 shrink-0 rounded-full border" />}
                <span className={done || active ? undefined : "text-muted-foreground"}>{label}</span>
              </li>
            );
          })}
        </ol>
      )}
      {run?.token && <p className="font-mono text-[11px] break-all text-muted-foreground">{run.token}</p>}
      {(run?.secure || run?.vulnerable) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["Secure verifier", run.secure, attack.secureWhy, 401],
            ["Vulnerable verifier", run.vulnerable, attack.vulnerableWhy, 200],
          ] as const).map(([label, res, why, wanted]) => (
            <div key={label} aria-live="polite" className="space-y-1 rounded border bg-background p-2">
              <p className="font-mono text-xs text-muted-foreground">{label}: GET /api/profile</p>
              {res ? (
                <>
                  <p className={`font-mono text-2xl font-semibold tabular-nums ${res.status === 200 ? "text-destructive" : "text-success"}`}>
                    <span>{res.status}</span>
                  </p>
                  <p className="text-xs">{res.status === wanted ? why : "Unexpected for this attack."}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">waiting…</p>
              )}
            </div>
          ))}
        </div>
      )}
      {run?.vulnerable && (
        <p className="text-sm font-medium">
          {expected ? "Same token, opposite outcome: only the verifier differs." : "Not the expected 401 and 200. Check that the lab is in its default state and run again."}
        </p>
      )}
      <Button variant="outline" size="sm" disabled={running} onClick={() => void go()}>
        Run {attack.id}
      </Button>
      {awaitingLogin && (
        <div className="flex items-center gap-2">
          <p role="status" className="text-sm text-muted-foreground">Sign in again to save your progress.</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={openReauth}>Sign in again</Button>
        </div>
      )}
    </section>
  );
}
