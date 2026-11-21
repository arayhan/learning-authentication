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
    forged: 'Header {"alg":"none"}, claims sub=forged-user, dan sama sekali tanpa signature.',
    secureWhy: "Secure verifier mengunci RS256, jadi token yang bilang none ditolak sebelum hal lain dicek.",
    vulnerableWhy: "Vulnerable verifier membiarkan token memilih algoritmanya sendiri. Ia memilih none, jadi nggak butuh signature.",
  },
  {
    id: "key-confusion",
    mode: "hs256-with-public-key",
    title: "Key confusion RS256 ke HS256",
    forged: "Header alg HS256, ditandatangani dengan HMAC memakai teks PUBLIC key server sebagai secret. Public key itu memang publik, jadi siapa pun bisa melakukannya.",
    secureWhy: "Secure verifier cuma memperlakukan key sebagai RSA public key dan cuma menerima RS256, jadi token HMAC nggak akan pernah lolos.",
    vulnerableWhy: "Vulnerable verifier pindah ke HMAC karena header-nya bilang begitu, lalu memakai public key sebagai secret.",
  },
  {
    id: "expired",
    mode: "expired",
    title: "Token expired",
    forged: "Token RS256 yang ditandatangani asli, tapi exp-nya sejam yang lalu.",
    secureWhy: "Secure verifier mewajibkan exp dan menolak token yang sudah lewat.",
    vulnerableWhy: "Vulnerable verifier ngecek signature tapi nggak pernah melihat exp (atau aud, atau iss).",
  },
];

type Run = { step: number; token?: string; secure?: { status: number; body: string }; vulnerable?: { status: number; body: string } };
const STEPS = ["Minta lab memalsukan token", "Kirim ke secure verifier", "Kirim ke vulnerable verifier"];

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
        <h3 className="text-sm font-semibold">Attack JWT, langsung</h3>
        <p className="text-xs text-muted-foreground">
          Jalan di lab pada {labBase("02", impl)}. Buka Inspector buat mantau tiap request. Nggak perlu akun: token palsunya nggak pernah menyentuh user asli.
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
        return setError(`Lab menolak memalsukan token (${sign.status}). Restart lab-nya.`);
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
                  <p className="text-xs">{res.status === wanted ? why : "Di luar dugaan untuk attack ini."}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">menunggu…</p>
              )}
            </div>
          ))}
        </div>
      )}
      {run?.vulnerable && (
        <p className="text-sm font-medium">
          {expected ? "Token sama, hasil berlawanan: yang beda cuma verifier-nya." : "Bukan 401 dan 200 seperti yang diharapkan. Pastikan lab dalam kondisi default lalu jalankan lagi."}
        </p>
      )}
      <Button variant="outline" size="sm" disabled={running} onClick={() => void go()}>
        Jalankan {attack.id}
      </Button>
      {awaitingLogin && (
        <div className="flex items-center gap-2">
          <p role="status" className="text-sm text-muted-foreground">Login lagi buat nyimpen progress kamu.</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={openReauth}>Login lagi</Button>
        </div>
      )}
    </section>
  );
}
