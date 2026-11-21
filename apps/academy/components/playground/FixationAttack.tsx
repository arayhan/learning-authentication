"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useProgress } from "@/components/game/ProgressProvider";
import { useSender } from "@/components/lesson/useSender";
import { Button } from "@/components/ui/button";
import { labBase } from "@/lib/labs";
import { useLabImpl } from "./LabImpl";
import { OfflineCard } from "./OfflineCard";

const REF = "m1-l4/fixation";
const VICTIM = { email: "fixation-victim@example.com", password: "correct horse battery" };
const STEPS = [
  "Attacker menanam session id pilihannya di browser korban",
  "Korban login, membawa session id itu",
  "Attacker memakai ulang id itu: GET /me",
];

type Mode = "vulnerable" | "secure";
type Col = { step: number; outcome?: { status: number; body: string }; error?: string };

const COPY: Record<Mode, { title: string; header: string; win: string; lose: string }> = {
  vulnerable: {
    title: "Mode vulnerable",
    header: "X-Lab-Mode: vulnerable",
    win: "Login mempertahankan id milik attacker, jadi attacker sekarang login sebagai korban.",
    lose: "Di luar dugaan: harusnya attacker berhasil masuk.",
  },
  secure: {
    title: "Secure (default)",
    header: "tanpa header khusus",
    win: "Di luar dugaan: harusnya attacker ditolak.",
    lose: "Login menerbitkan id baru dan menghapus id yang ditanam, jadi id attacker nggak ada gunanya.",
  },
};

/** Runs the real attack against the selected lab implementation, once per mode, and shows both outcomes side by side. */
export function FixationAttack() {
  const [impl] = useLabImpl();
  const { isDone } = useProgress();
  const [cols, setCols] = useState<Partial<Record<Mode, Col>>>({});
  const [running, setRunning] = useState<Mode | null>(null);
  const [offline, setOffline] = useState(false);
  const sent = useRef(false);
  const { fire, busy, awaitingLogin, openReauth } = useSender((o) => {
    if (!o.ok) sent.current = false;
  });

  const v = cols.vulnerable?.outcome;
  const s = cols.secure?.outcome;
  const expected = v?.status === 200 && s?.status === 401;
  useEffect(() => {
    if (!expected || sent.current || isDone(REF)) return;
    sent.current = true;
    void fire({ kind: "attack", ref: REF });
  }, [expected, isDone, fire]);

  const run = async (mode: Mode) => {
    const base = labBase("01", impl);
    const sid = `fixation-${mode}-${crypto.randomUUID()}`;
    const post = (path: string, body: unknown, vulnerable: boolean) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(vulnerable ? { "X-Lab-Mode": "vulnerable" } : {}) },
        body: JSON.stringify(body),
        credentials: "include",
      });
    const patch = (c: Col) => setCols((all) => ({ ...all, [mode]: c }));

    setRunning(mode);
    setOffline(false);
    try {
      patch({ step: 0 });
      await post("/register", VICTIM, false); // 201, or 409 when it already exists: both fine
      // The helper is only reachable in vulnerable mode, for both runs: browsers forbid JS from planting a cookie, so the lab does it.
      const plant = await post("/__attack/plant-sid", { sid }, true);
      if (!plant.ok) return patch({ step: 1, error: `Gagal menanam session id (${plant.status}). Restart lab-nya.` });
      patch({ step: 1 });
      const login = await post("/login", VICTIM, mode === "vulnerable");
      if (!login.ok) return patch({ step: 2, error: `Login korban gagal (${login.status}).` });
      patch({ step: 2 });
      const as = await post("/__attack/as", { sid, path: "/me" }, true);
      if (!as.ok) return patch({ step: 3, error: `Replay gagal (${as.status}).` });
      const { status, body } = (await as.json()) as { status: number; body: string };
      patch({ step: 3, outcome: { status, body } });
    } catch {
      setOffline(true);
      setCols((all) => ({ ...all, [mode]: undefined }));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Session fixation, langsung</h3>
        <p className="text-xs text-muted-foreground">
          Jalan di lab pada {labBase("01", impl)}. Buka Inspector buat mantau tiap request. Akun korban dibuatin otomatis.
        </p>
      </div>

      {offline && <OfflineCard lab="01" impl={impl} retrying={false} />}

      <div className="grid gap-3 sm:grid-cols-2">
        {(["vulnerable", "secure"] as const).map((mode) => {
          const c = cols[mode];
          const copy = COPY[mode];
          const hit = c?.outcome && (mode === "vulnerable" ? c.outcome.status === 200 : c.outcome.status === 401);
          return (
            <section key={mode} aria-label={copy.title} className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-semibold">{copy.title}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{copy.header}</p>
              </div>
              <ol className="space-y-1.5 text-xs">
                {STEPS.map((label, i) => {
                  const done = !!c && c.step > i;
                  const active = running === mode && c?.step === i;
                  return (
                    <li key={label} className="flex items-start gap-2">
                      {done ? <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" /> : active ? <Loader2 aria-hidden className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" /> : <span aria-hidden className="mt-0.5 size-3.5 shrink-0 rounded-full border" />}
                      <span className={done || active ? undefined : "text-muted-foreground"}>{label}</span>
                    </li>
                  );
                })}
              </ol>
              {c?.error && <p role="alert" className="text-xs text-destructive">{c.error}</p>}
              {c?.outcome && (
                <div aria-live="polite" className="space-y-1 rounded border bg-background p-2">
                  <p className="font-mono text-xs text-muted-foreground">Attacker GET /me</p>
                  <p className={`font-mono text-2xl font-semibold tabular-nums ${c.outcome.status === 200 ? "text-destructive" : "text-success"}`}>
                    <span>{c.outcome.status}</span>
                  </p>
                  <p className="text-xs">{hit ? copy.win : copy.lose}</p>
                </div>
              )}
              <Button variant="outline" size="sm" disabled={running !== null} onClick={() => void run(mode)}>
                Jalankan {mode}
              </Button>
            </section>
          );
        })}
      </div>

      {expected && !awaitingLogin && <p className="text-sm font-medium">Attack selesai: attack sama, hasil berlawanan.</p>}
      {awaitingLogin && (
        <div className="flex items-center gap-2">
          <p role="status" className="text-sm text-muted-foreground">Login lagi buat nyimpen progress kamu.</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={openReauth}>Login lagi</Button>
        </div>
      )}
    </div>
  );
}
