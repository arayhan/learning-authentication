"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { labBase } from "@/lib/labs";
import { useLabImpl } from "./LabImpl";
import { LabSwitcher } from "./LabSwitcher";
import { OfflineCard } from "./OfflineCard";
import { RFC_VERIFIER, VERIFIER_RE, clientBase, randomVerifier, s256, useBootRandom } from "./oauth";

type Calc = { verifier: string; bytesHex: string; digestHex: string; challenge: string };
type Probe = { state: "idle" } | { state: "busy" } | { state: "done"; status: number; error: string } | { state: "offline" };

/**
 * PKCE S256 one step at a time: verifier, its ASCII bytes, the SHA-256 digest, then base64url. Edit the verifier and
 * every step recomputes. The test button posts a deliberately wrong verifier to the lab's /token endpoint.
 */
export function PkceGenerator() {
  const [impl] = useLabImpl();
  const [edited, setVerifier] = useState<string | null>(null);
  // Random only on the client: a server-rendered random value would not match the browser's.
  const boot = useBootRandom("verifier", randomVerifier);
  const verifier = edited ?? boot;
  const [code, setCode] = useState("");
  const [calc, setCalc] = useState<Calc | null>(null);
  const [probe, setProbe] = useState<Probe>({ state: "idle" });

  const valid = VERIFIER_RE.test(verifier);
  useEffect(() => {
    if (!valid) return;
    let stale = false;
    void s256(verifier).then((r) => !stale && setCalc({ verifier, ...r }));
    return () => {
      stale = true;
    };
  }, [verifier, valid]);
  const shown = valid && calc?.verifier === verifier ? calc : null;

  const test = async () => {
    setProbe({ state: "busy" });
    let wrong = randomVerifier();
    while (wrong === verifier) wrong = randomVerifier();
    try {
      const res = await fetch(`${labBase("03", impl)}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: "demo-spa",
          code: code.trim() || "not-a-real-code",
          redirect_uri: `${clientBase(impl)}/callback`,
          code_verifier: wrong,
        }).toString(),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setProbe({ state: "done", status: res.status, error: body.error ?? "(no error field)" });
    } catch {
      setProbe({ state: "offline" });
    }
  };

  const rows: [string, string, string | undefined][] = [
    ["Verifier bytes (hex)", "The verifier is plain ASCII, so each character is one byte.", shown?.bytesHex],
    ["SHA-256 digest (hex)", "32 bytes. A one-way function: the challenge does not reveal the verifier.", shown?.digestHex],
  ];

  return (
    <div className="max-w-3xl space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">PKCE S256 generator</h3>
        <LabSwitcher />
      </div>

      <div className="space-y-2">
        <label htmlFor="pkce-verifier" className="text-xs font-medium">Code verifier</label>
        <textarea
          id="pkce-verifier"
          value={verifier}
          onChange={(e) => setVerifier(e.target.value.trim())}
          rows={2}
          spellCheck={false}
          className="w-full rounded-md border bg-background p-2 font-mono text-xs break-all"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setVerifier(randomVerifier())}>Generate a new one</Button>
          <Button variant="outline" size="sm" onClick={() => setVerifier(RFC_VERIFIER)}>Use the RFC 7636 example</Button>
        </div>
        {!valid && verifier !== "" && (
          <p role="alert" className="text-xs text-destructive">
            A verifier is 43 to 128 characters from A-Z a-z 0-9 - . _ ~ (RFC 7636 section 4.1). This one has {verifier.length}.
          </p>
        )}
      </div>

      {shown && (
        <ol className="space-y-3 text-xs">
          {rows.map(([label, why, value], i) => (
            <li key={label} className="space-y-1">
              <p className="font-medium">{i + 1}. {label}</p>
              <p className="text-muted-foreground">{why}</p>
              <output aria-label={label} className="block rounded border bg-muted/30 p-2 font-mono break-all">{value}</output>
            </li>
          ))}
          <li className="space-y-1">
            <p className="font-medium">3. Base64url of the digest, no padding</p>
            <p className="text-muted-foreground">43 characters. This is the code_challenge, the only part that travels in the browser URL.</p>
            <output aria-label="code_challenge" className="block rounded border border-brand/40 bg-muted/30 p-2 font-mono font-semibold break-all">{shown.challenge}</output>
          </li>
        </ol>
      )}

      <div className="space-y-2 border-t pt-3">
        <p className="text-sm font-medium">Try a wrong verifier on the lab</p>
        <p className="text-xs text-muted-foreground">
          Posts a freshly invented verifier (not the one above) to {labBase("03", impl)}/token. Paste a real authorization code to see the server reject a genuine code; leave it empty to send a made-up one.
        </p>
        <label htmlFor="pkce-code" className="text-xs font-medium">Authorization code (optional)</label>
        <input id="pkce-code" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} className="w-full rounded-md border bg-background p-2 font-mono text-xs" />
        <Button variant="outline" size="sm" disabled={probe.state === "busy"} onClick={() => void test()}>Test a wrong verifier</Button>
        {probe.state === "offline" && <OfflineCard lab="03" impl={impl} retrying={false} />}
        {probe.state === "done" && (
          <div aria-live="polite" className="space-y-1 rounded border bg-muted/30 p-2 text-xs">
            <p className="font-mono">POST /token → {probe.status} <span className="font-semibold">{probe.error}</span></p>
            {probe.error === "invalid_grant" && (
              <p>
                The server answers invalid_grant for a wrong verifier, an unknown code, an expired code and a reused code alike, with no hint which. That is deliberate (RFC 6749 section 5.2): an attacker learns nothing from the difference.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
