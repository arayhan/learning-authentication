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
      setProbe({ state: "done", status: res.status, error: body.error ?? "(nggak ada field error)" });
    } catch {
      setProbe({ state: "offline" });
    }
  };

  const rows: [string, string, string | undefined][] = [
    ["Verifier bytes (hex)", "Verifier-nya ASCII biasa, jadi satu karakter sama dengan satu byte.", shown?.bytesHex],
    ["SHA-256 digest (hex)", "32 byte. Fungsi satu arah: challenge nggak membocorkan verifier.", shown?.digestHex],
  ];

  return (
    <div className="max-w-3xl space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Generator PKCE S256</h3>
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
          <Button variant="outline" size="sm" onClick={() => setVerifier(randomVerifier())}>Bikin yang baru</Button>
          <Button variant="outline" size="sm" onClick={() => setVerifier(RFC_VERIFIER)}>Pakai contoh RFC 7636</Button>
        </div>
        {!valid && verifier !== "" && (
          <p role="alert" className="text-xs text-destructive">
            Verifier harus 43 sampai 128 karakter dari A-Z a-z 0-9 - . _ ~ (RFC 7636 section 4.1). Yang ini {verifier.length} karakter.
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
            <p className="font-medium">3. Base64url dari digest, tanpa padding</p>
            <p className="text-muted-foreground">43 karakter. Ini code_challenge, satu-satunya bagian yang lewat di URL browser.</p>
            <output aria-label="code_challenge" className="block rounded border border-brand/40 bg-muted/30 p-2 font-mono font-semibold break-all">{shown.challenge}</output>
          </li>
        </ol>
      )}

      <div className="space-y-2 border-t pt-3">
        <p className="text-sm font-medium">Coba verifier yang salah di lab</p>
        <p className="text-xs text-muted-foreground">
          Kirim verifier karangan baru (bukan yang di atas) ke {labBase("03", impl)}/token. Tempel authorization code asli biar kelihatan server menolak code yang asli; kosongkan kalau mau kirim code palsu.
        </p>
        <label htmlFor="pkce-code" className="text-xs font-medium">Authorization code (opsional)</label>
        <input id="pkce-code" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} className="w-full rounded-md border bg-background p-2 font-mono text-xs" />
        <Button variant="outline" size="sm" disabled={probe.state === "busy"} onClick={() => void test()}>Tes verifier yang salah</Button>
        {probe.state === "offline" && <OfflineCard lab="03" impl={impl} retrying={false} />}
        {probe.state === "done" && (
          <div aria-live="polite" className="space-y-1 rounded border bg-muted/30 p-2 text-xs">
            <p className="font-mono">POST /token → {probe.status} <span className="font-semibold">{probe.error}</span></p>
            {probe.error === "invalid_grant" && (
              <p>
                Server menjawab invalid_grant untuk verifier yang salah, code yang nggak dikenal, code expired, maupun code yang dipakai ulang, tanpa petunjuk mana yang terjadi. Ini disengaja (RFC 6749 section 5.2): attacker nggak dapat info apa pun dari perbedaannya.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
