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
  response_type: "code berarti minta flow authorization code.",
  client_id: "Client terdaftar mana yang meminta. Lab-nya kenal demo-spa.",
  redirect_uri: "Ke mana browser kembali membawa code. Harus sama persis dengan URI terdaftar. Di sini di-percent-encode.",
  scope: "Akses apa yang diminta, dipisah spasi. Spasi jadi %20 di URL.",
  state: "Nilai yang nggak bisa ditebak, dicek client saat kembali, buat mengikat response ke request-nya sendiri.",
  code_challenge: "BASE64URL(SHA-256(verifier)). Verifier-nya sendiri tetap di client.",
  code_challenge_method: "S256 satu-satunya method yang diterima lab. plain bakal ngirim secret-nya apa adanya.",
  lab_mode: "Khusus lab: minta authorization server berperilaku lemah dengan sengaja. Navigasi browser nggak bisa menambah header X-Lab-Mode, jadi dikirim lewat query.",
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
        <h3 className="text-sm font-semibold">Builder authorization request</h3>
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
          Mode vulnerable (lab_mode=vulnerable)
        </label>
        <Button variant="outline" size="xs" onClick={() => setRedirect(`${clientBase(impl)}${EVIL}`)}>Pakai redirect {EVIL}</Button>
        <Button variant="outline" size="xs" onClick={() => setRedirect(null)}>Reset redirect</Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">URL</p>
        <output aria-label="URL authorize" className="block rounded border bg-muted/30 p-2 font-mono text-xs break-all">{url}</output>
        <ul aria-label="Anotasi" className="space-y-1 text-xs">
          {authorizeEntries(params).map(([k, v]) => (
            <li key={k}>
              <span className="font-mono font-semibold">{k}</span>
              <span className="font-mono text-muted-foreground">={encodeURIComponent(v)}</span>
              <span className="block text-muted-foreground">{WHY[k]}</span>
            </li>
          ))}
        </ul>
        {!fields.code_challenge && !vulnerable && <p className="text-xs text-warning">Tanpa code_challenge: secure server bakal menjawab error=invalid_request.</p>}
        <Button size="sm" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>Buka di tab baru</Button>
        <p className="text-xs text-muted-foreground">Login sebagai alice@example.com / correct-horse-battery. Browser kembali ke redirect_uri, jadi client SPA di sana nggak akan mengenali request yang bukan dia yang mulai. Itu normal.</p>
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
    <section aria-label="Attack redirect prefix" className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Attack redirect prefix</p>
        <p className="text-xs text-muted-foreground">
          redirect_uri yang terdaftar adalah {clientBase(impl)}/callback. Attacker meminta {clientBase(impl)}{EVIL}, yang cuma kebetulan diawali itu. Request yang sama dikirim ke secure server (exact match) dan ke vulnerable server (prefix match).
        </p>
      </div>
      {offline && <OfflineCard lab="03" impl={impl} retrying={false} />}
      {(seen.secure !== undefined || seen.vulnerable !== undefined) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["Secure server", seen.secure, 400, "Ditolak dengan halaman error. Nggak ada redirect, jadi code nggak pernah terkirim ke URL attacker."],
            ["Vulnerable server", seen.vulnerable, 200, "Diterima: menampilkan halaman login. Setelah disetujui, code bakal di-redirect ke URL attacker."],
          ] as const).map(([label, status, wanted, why]) => (
            <div key={label} aria-live="polite" className="space-y-1 rounded border bg-background p-2">
              <p className="font-mono text-xs text-muted-foreground">{label}: GET /authorize</p>
              {status === undefined ? (
                <p className="text-xs text-muted-foreground">menunggu…</p>
              ) : (
                <>
                  <p className={`font-mono text-2xl font-semibold tabular-nums ${status === 200 ? "text-destructive" : "text-success"}`}>{status}</p>
                  <p className="text-xs">{status === wanted ? why : "Di luar dugaan untuk attack ini."}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {seen.vulnerable !== undefined && !expected && <p className="text-xs">Bukan 400 dan 200 seperti yang diharapkan. Pastikan lab dalam kondisi default lalu jalankan lagi.</p>}
      <Button variant="outline" size="sm" disabled={running} onClick={() => void go()}>Jalankan attack redirect</Button>
      {awaitingLogin && (
        <div className="flex items-center gap-2">
          <p role="status" className="text-sm text-muted-foreground">Login lagi buat nyimpen progress kamu.</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={openReauth}>Login lagi</Button>
        </div>
      )}
    </section>
  );
}
