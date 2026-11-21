"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProgress } from "@/components/game/ProgressProvider";
import { useSender } from "@/components/lesson/useSender";
import { Button } from "@/components/ui/button";
import type { TraceEvent } from "@/lib/course/types";
import { labBase, type Impl } from "@/lib/labs";
import { useLabImpl } from "./LabImpl";
import { OfflineCard } from "./OfflineCard";
import { RFC_CHALLENGE, authorizeUrl, clientBase } from "./oauth";
import { useTraceStream } from "./useTraceStream";

type Slot = "vulnerable" | "secure";
type Outcome = { code: string; status: number; body: string };

const SLOTS: Record<Slot, { state: string; open: string; replay: string; title: string; blurb: string }> = {
  vulnerable: {
    state: "m3-l4-vulnerable",
    open: "Open the authorize page without PKCE",
    replay: "Replay the code without PKCE",
    title: "Flow A: no PKCE (vulnerable mode)",
    blurb: "The app sends no code_challenge, so the code is not bound to anything the attacker lacks.",
  },
  secure: {
    state: "m3-l4-secure",
    open: "Open the authorize page with PKCE",
    replay: "Replay the code with PKCE",
    title: "Flow B: PKCE with S256 (secure)",
    blurb: "The app sends a code_challenge. The matching verifier never left the app, so a stolen code is not enough.",
  },
};

/** The code the AS put in a redirect, read from the Location header of its own POST /consent 302 (the lab trace is the "intercepted" URL). */
function codeFor(events: TraceEvent[], state: string): string | null {
  for (const e of [...events].reverse()) {
    if (e.req.method !== "POST" || e.req.path !== "/consent" || e.res.status !== 302) continue;
    try {
      const loc = new URL([e.res.headers.location ?? []].flat()[0] ?? "");
      if (loc.searchParams.get("state") === state && loc.searchParams.get("code")) return loc.searchParams.get("code");
    } catch {}
  }
  return null;
}

const shortToken = (body: string) => {
  try {
    const t = (JSON.parse(body) as { access_token?: string }).access_token;
    return t ? JSON.stringify({ ...JSON.parse(body), access_token: `${t.slice(0, 24)}…` }) : body;
  } catch {
    return body;
  }
};

/**
 * Authorization code interception, live. A malicious app that registered the same custom URL scheme as the legit
 * mobile app receives the redirect (here: the code is read from the AS trace). Two codes are replayed through the lab's
 * /__attack/intercept helper, which plays the attacker: the code and redirect_uri, but no PKCE verifier.
 */
export function InterceptionAttack() {
  const [impl] = useLabImpl();
  const { status, events } = useTraceStream("03", impl);
  const codes = useMemo<Record<Slot, string | null>>(() => ({ vulnerable: codeFor(events, SLOTS.vulnerable.state), secure: codeFor(events, SLOTS.secure.state) }), [events]);
  const [outcomes, setOutcomes] = useState<Partial<Record<Slot, Outcome>>>({});
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<Slot | null>(null);

  const ref = "m3-l4/code-interception";
  const { isDone } = useProgress();
  const sent = useRef(false);
  const sender = useSender((o) => {
    if (!o.ok) sent.current = false;
  });
  const fire = sender.fire;

  // An outcome only counts for the code it was made with.
  const valid = (s: Slot) => (outcomes[s]?.code === codes[s] ? outcomes[s] : undefined);
  const expected = valid("vulnerable")?.status === 200 && valid("secure")?.status === 400;
  useEffect(() => {
    if (!expected || sent.current || isDone(ref)) return;
    sent.current = true;
    void fire({ kind: "attack", ref });
  }, [expected, isDone, fire]);

  const open = (s: Slot) =>
    window.open(
      authorizeUrl(labBase("03", impl), {
        client_id: "demo-spa",
        redirect_uri: `${clientBase(impl)}/callback`,
        scope: "photos.read",
        state: SLOTS[s].state,
        code_challenge: s === "secure" ? RFC_CHALLENGE : "",
        vulnerable: s === "vulnerable",
      }),
      "_blank",
      "noopener,noreferrer",
    );

  const replay = async (s: Slot) => {
    const code = codes[s];
    if (!code) return;
    setBusy(s);
    setOffline(false);
    try {
      const res = await fetch(`${labBase("03", impl)}/__attack/intercept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Lab-Mode": "vulnerable" },
        body: JSON.stringify({ code }),
      });
      const body = shortToken(await res.text());
      setOutcomes((o) => ({ ...o, [s]: { code, status: res.status, body } }));
    } catch {
      setOffline(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Authorization code interception, live</h3>
        <p className="text-xs text-muted-foreground">Runs against the lab at {labBase("03", impl)}. Each flow ends with a code in a redirect URL, which is exactly what the malicious app sees.</p>
      </div>

      <Diagram impl={impl} />
      {(status === "offline" || offline) && <OfflineCard lab="03" impl={impl} retrying={status === "offline"} />}

      <ol className="space-y-3 text-sm">
        {(Object.keys(SLOTS) as Slot[]).map((s) => {
          const out = valid(s);
          return (
            <li key={s}>
              <section aria-label={SLOTS[s].title} className="space-y-2 rounded-md border bg-muted/30 p-3">
                <p className="font-semibold">{SLOTS[s].title}</p>
                <p className="text-xs text-muted-foreground">{SLOTS[s].blurb}</p>
                <p className="text-xs text-muted-foreground">Open the page, sign in as alice@example.com (password correct-horse-battery) and approve. The code is picked up from the lab trace.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => open(s)}>{SLOTS[s].open}</Button>
                  <Button size="sm" disabled={!codes[s] || busy === s} onClick={() => void replay(s)}>{SLOTS[s].replay}</Button>
                </div>
                <p className="font-mono text-xs break-all text-muted-foreground">{codes[s] ? `code seen: ${codes[s]}` : "waiting for the redirect…"}</p>
                {out && (
                  <div aria-live="polite" className="space-y-1 rounded border bg-background p-2">
                    <p className="font-mono text-xs text-muted-foreground">Malicious app: POST /__attack/intercept</p>
                    <p className={`font-mono text-2xl font-semibold tabular-nums ${out.status === 200 ? "text-destructive" : "text-success"}`}>{out.status}</p>
                    <p className="font-mono text-xs break-all">{out.body}</p>
                    <p className="text-xs">
                      {s === "vulnerable"
                        ? out.status === 200 ? "The attacker got an access token for alice. A code with no challenge is a bearer secret." : "Unexpected for this attack."
                        : out.status === 400 ? "invalid_grant. The attacker has the code but cannot produce the verifier, and a failed guess does not burn the real app's code." : "Unexpected for this attack."}
                    </p>
                  </div>
                )}
              </section>
            </li>
          );
        })}
      </ol>

      {expected && <p className="text-sm font-medium">Same attacker, same capture, opposite outcome: only the PKCE challenge differs.</p>}
      {sender.awaitingLogin && (
        <div className="flex items-center gap-2">
          <p role="status" className="text-sm text-muted-foreground">Sign in again to save your progress.</p>
          <Button variant="outline" size="sm" disabled={sender.busy} onClick={sender.openReauth}>Sign in again</Button>
        </div>
      )}
    </div>
  );
}

/** Static picture of the attack: two apps claim the same custom URL scheme, and the OS may deliver the redirect to either. */
function Diagram({ impl }: { impl: Impl }) {
  const box = "rounded-md border bg-background px-2 py-1.5 text-center text-xs";
  return (
    <figure aria-label="Interception diagram" className="space-y-2 rounded-md border p-3">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-xs">
        <div className={box}><p className="font-semibold">Bank app</p><p className="text-muted-foreground">claims bankapp://</p></div>
        <span aria-hidden>→</span>
        <div className={box}><p className="font-semibold">System browser</p><p className="text-muted-foreground">user approves</p></div>
        <span aria-hidden>→</span>
        <div className={box}><p className="font-semibold">Authorization server</p><p className="text-muted-foreground">{labBase("03", impl).replace("http://", "")}</p></div>
      </div>
      <p className="text-center text-xs text-muted-foreground">↓ 302 to bankapp://callback?code=…</p>
      <div className="grid grid-cols-2 gap-2">
        <div className={box}><p className="font-semibold">Bank app</p><p className="text-muted-foreground">expected recipient</p></div>
        <div className={`${box} border-dashed border-destructive/60`}><p className="font-semibold text-destructive">Malicious app</p><p className="text-muted-foreground">also claims bankapp://</p></div>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Custom schemes are not unique: any installed app can claim one (RFC 8252 section 8.6). In the lab the browser lands on {clientBase(impl)}/callback and the code is read from the trace instead.
      </figcaption>
    </figure>
  );
}
