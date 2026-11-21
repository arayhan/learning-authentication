"use client";

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@/components/game/ProgressProvider";
import { useSender } from "@/components/lesson/useSender";
import { Button } from "@/components/ui/button";
import { labBase, type Impl } from "@/lib/labs";
import { useLabImpl } from "./LabImpl";
import { LabSwitcher } from "./LabSwitcher";
import { OfflineCard } from "./OfflineCard";
import { RFC_CHALLENGE, authorizeEntries, authorizeUrl, clientBase, randomVerifier, useBootRandom } from "./oauth";

const WHY: Record<string, string> = {
  response_type: "code asks for the authorization code flow.",
  client_id: "Which registered client is asking. The lab knows demo-spa.",
  redirect_uri: "Where the browser returns with the code. It must equal a registered URI exactly. Percent-encoded here.",
  scope: "What access is requested, space separated. A space is %20 in a URL.",
  state: "An unguessable value the client checks on return, to tie the response to its own request.",
  code_challenge: "BASE64URL(SHA-256(verifier)). The verifier itself stays with the client.",
  code_challenge_method: "S256 is the only method the lab accepts. plain would send the secret in the clear.",
  lab_mode: "Lab only: asks the authorization server to behave in its deliberately weak way. A browser navigation cannot add the X-Lab-Mode header, so it travels in the query.",
};

const EVIL = "/callback.evil";
type Seen = { secure?: number; vulnerable?: number };

/**
 * Builds the /authorize URL from form fields and annotates every parameter. "Open" launches it in a new tab on the
 * selected implementation. With `attack`, a second panel runs the redirect-prefix attack: the same request with a
 * redirect_uri of ".../callback.evil", sent to the secure server and to the vulnerable (prefix match) one.
 */
export function OAuthUrlBuilder({ attack = false }: { attack?: boolean }) {
  const [impl] = useLabImpl();
  const [edits, setFields] = useState({ client_id: "demo-spa", scope: "photos.read profile", state: null as string | null, code_challenge: RFC_CHALLENGE });
  const bootState = useBootRandom("state", () => randomVerifier().slice(0, 16)); // random on the client only
  const fields = { ...edits, state: edits.state ?? bootState };
  const [redirect, setRedirect] = useState<string | null>(null); // null: the default for the selected implementation
  const [vulnerable, setVulnerable] = useState(false);

  const redirectUri = redirect ?? `${clientBase(impl)}/callback`;
  const params = { ...fields, redirect_uri: redirectUri, vulnerable };
  const url = authorizeUrl(labBase("03", impl), params);
  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="max-w-3xl space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Authorization request builder</h3>
        <LabSwitcher />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ["client_id", fields.client_id, set("client_id")],
          ["redirect_uri", redirectUri, (e: React.ChangeEvent<HTMLInputElement>) => setRedirect(e.target.value)],
          ["scope", fields.scope, set("scope")],
          ["state", fields.state, set("state")],
          ["code_challenge", fields.code_challenge, set("code_challenge")],
        ] as const).map(([name, value, onChange]) => (
          <div key={name} className={name === "redirect_uri" || name === "code_challenge" ? "space-y-1 sm:col-span-2" : "space-y-1"}>
            <label htmlFor={`oauth-${name}`} className="text-xs font-medium">{name}</label>
            <input id={`oauth-${name}`} value={value} onChange={onChange} spellCheck={false} className="w-full rounded-md border bg-background p-2 font-mono text-xs" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={vulnerable} onChange={(e) => setVulnerable(e.target.checked)} />
          Vulnerable mode (lab_mode=vulnerable)
        </label>
        <Button variant="outline" size="xs" onClick={() => setRedirect(`${clientBase(impl)}${EVIL}`)}>Use the {EVIL} redirect</Button>
        <Button variant="outline" size="xs" onClick={() => setRedirect(null)}>Reset redirect</Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">URL</p>
        <output aria-label="Authorize URL" className="block rounded border bg-muted/30 p-2 font-mono text-xs break-all">{url}</output>
        <ul aria-label="Annotations" className="space-y-1 text-xs">
          {authorizeEntries(params).map(([k, v]) => (
            <li key={k}>
              <span className="font-mono font-semibold">{k}</span>
              <span className="font-mono text-muted-foreground">={encodeURIComponent(v)}</span>
              <span className="block text-muted-foreground">{WHY[k]}</span>
            </li>
          ))}
        </ul>
        {!fields.code_challenge && !vulnerable && <p className="text-xs text-warning">No code_challenge: the secure server will answer with error=invalid_request.</p>}
        <Button size="sm" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>Open in a new tab</Button>
        <p className="text-xs text-muted-foreground">Sign in as alice@example.com / correct-horse-battery. The browser returns to the redirect_uri, so the client SPA there will not recognise a request it did not start. That is expected.</p>
      </div>

      {attack && <RedirectAttack impl={impl} />}
    </div>
  );
}

function RedirectAttack({ impl }: { impl: Impl }) {
  const ref = "m3-l5/redirect-prefix";
  const { isDone } = useProgress();
  const [seen, setSeen] = useState<Seen>({});
  const [running, setRunning] = useState(false);
  const [offline, setOffline] = useState(false);
  const sent = useRef(false);
  const { fire, busy, awaitingLogin, openReauth } = useSender((o) => {
    if (!o.ok) sent.current = false;
  });

  const expected = seen.secure === 400 && seen.vulnerable === 200;
  useEffect(() => {
    if (!expected || sent.current || isDone(ref)) return;
    sent.current = true;
    void fire({ kind: "attack", ref });
  }, [expected, isDone, fire]);

  const go = async () => {
    setRunning(true);
    setOffline(false);
    setSeen({});
    const base = { client_id: "demo-spa", redirect_uri: `${clientBase(impl)}${EVIL}`, scope: "photos.read", state: "m3-l5-redirect", code_challenge: RFC_CHALLENGE };
    try {
      const secure = await fetch(authorizeUrl(labBase("03", impl), { ...base, vulnerable: false }));
      setSeen({ secure: secure.status });
      const weak = await fetch(authorizeUrl(labBase("03", impl), { ...base, vulnerable: true }));
      setSeen({ secure: secure.status, vulnerable: weak.status });
    } catch {
      setSeen({});
      setOffline(true);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section aria-label="Redirect prefix attack" className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Redirect prefix attack</p>
        <p className="text-xs text-muted-foreground">
          The registered redirect_uri is {clientBase(impl)}/callback. The attacker asks for {clientBase(impl)}{EVIL}, which merely starts with it. The same request goes to the secure server (exact match) and to the vulnerable one (prefix match).
        </p>
      </div>
      {offline && <OfflineCard lab="03" impl={impl} retrying={false} />}
      {(seen.secure !== undefined || seen.vulnerable !== undefined) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["Secure server", seen.secure, 400, "Rejected with an error page. There is no redirect, so the code can never be sent to the attacker's URL."],
            ["Vulnerable server", seen.vulnerable, 200, "Accepted: it shows the sign-in page. After approval it would redirect the code to the attacker's URL."],
          ] as const).map(([label, status, wanted, why]) => (
            <div key={label} aria-live="polite" className="space-y-1 rounded border bg-background p-2">
              <p className="font-mono text-xs text-muted-foreground">{label}: GET /authorize</p>
              {status === undefined ? (
                <p className="text-xs text-muted-foreground">waiting…</p>
              ) : (
                <>
                  <p className={`font-mono text-2xl font-semibold tabular-nums ${status === 200 ? "text-destructive" : "text-success"}`}>{status}</p>
                  <p className="text-xs">{status === wanted ? why : "Unexpected for this attack."}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {seen.vulnerable !== undefined && !expected && <p className="text-xs">Not the expected 400 and 200. Check that the lab is in its default state and run again.</p>}
      <Button variant="outline" size="sm" disabled={running} onClick={() => void go()}>Run redirect attack</Button>
      {awaitingLogin && (
        <div className="flex items-center gap-2">
          <p role="status" className="text-sm text-muted-foreground">Sign in again to save your progress.</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={openReauth}>Sign in again</Button>
        </div>
      )}
    </section>
  );
}
