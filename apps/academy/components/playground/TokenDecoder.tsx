"use client";

import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { labBase } from "@/lib/labs";
import { useLabImpl } from "./LabImpl";
import { LabSwitcher } from "./LabSwitcher";
import { OfflineCard } from "./OfflineCard";
import { CLAIMS, decodeJwt, timeLabel } from "./jwt";

// What the lab's secure verifier checks (labs/02-jwt tokens.go and tokens.ts). Same strings in both implementations.
const ISSUER = "http://localhost:4102";
const AUDIENCE = "lab02-api";

type Check = { state: "idle" } | { state: "busy" } | { state: "valid"; kid: string } | { state: "failed"; message: string } | { state: "offline" };

const show = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/**
 * Paste a JWT to see it taken apart. Decoding is pure and never throws; it proves nothing about authenticity.
 * "Verify with lab JWKS" checks the signature in the browser with jose, with the lab's own rules: RS256 pinned,
 * issuer and audience required.
 */
export function TokenDecoder({ defaultToken = "" }: { defaultToken?: string }) {
  const [impl] = useLabImpl();
  const [input, setInput] = useState(defaultToken);
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const decoded = input.trim() ? decodeJwt(input) : null;
  const token = input.trim().replace(/^bearer\s+/i, "");

  const verify = async () => {
    setCheck({ state: "busy" });
    try {
      const jwks = createRemoteJWKSet(new URL(`${labBase("02", impl)}/.well-known/jwks.json`));
      const { protectedHeader } = await jwtVerify(token, jwks, { algorithms: ["RS256"], issuer: ISSUER, audience: AUDIENCE });
      setCheck({ state: "valid", kid: String(protectedHeader.kid ?? "") });
    } catch (e) {
      // A JOSE error means the lab answered and the token failed a rule. Anything else (fetch failed, timeout) means no lab.
      if (e instanceof errors.JOSEError && !(e instanceof errors.JWKSTimeout)) setCheck({ state: "failed", message: e.message });
      else setCheck({ state: "offline" });
    }
  };

  const claimRows = decoded?.ok
    ? [
        ...["alg", "kid", "typ"].filter((k) => k in decoded.header).map((k) => ({ name: k, value: decoded.header[k], where: "header" })),
        ...Object.keys(decoded.payload).filter((k) => k in CLAIMS).map((k) => ({ name: k, value: decoded.payload[k], where: "payload" })),
      ]
    : [];

  return (
    <div className="max-w-3xl space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Token decoder</h3>
        <p className="text-xs text-muted-foreground">Paste any JWT. Decoding happens in your browser and sends nothing anywhere.</p>
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">JWT</span>
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setCheck({ state: "idle" });
          }}
          rows={4}
          spellCheck={false}
          placeholder="eyJhbGciOiJSUzI1NiIs…"
          className="w-full rounded-md border bg-background p-2 font-mono text-xs break-all"
        />
      </label>

      {decoded && !decoded.ok && (
        <p role="alert" className="text-sm text-destructive">
          {decoded.error}
        </p>
      )}

      {decoded?.ok && (
        <>
          <p role="group" aria-label="Colour-coded token" className="rounded-md border bg-muted/30 p-3 font-mono text-xs leading-5 break-all">
            <span className="text-brand">{decoded.parts[0]}</span>
            <span className="text-muted-foreground">.</span>
            <span className="text-success">{decoded.parts[1]}</span>
            <span className="text-muted-foreground">.</span>
            <span className="text-warning">{decoded.parts[2] || "(empty signature)"}</span>
          </p>

          {String(decoded.header.alg).toLowerCase() === "none" && (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">
              The header says alg is &quot;none&quot;: this token is unsigned. A real verifier rejects it.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <section aria-label="Header" className="min-w-0 space-y-1.5 rounded-md border border-brand/40 p-3">
              <h4 className="text-xs font-semibold text-brand">Header</h4>
              <pre className="overflow-x-auto font-mono text-xs">{JSON.stringify(decoded.header, null, 2)}</pre>
            </section>
            <section aria-label="Payload" className="min-w-0 space-y-1.5 rounded-md border border-success/40 p-3">
              <h4 className="text-xs font-semibold text-success">Payload</h4>
              <pre className="overflow-x-auto font-mono text-xs">{JSON.stringify(decoded.payload, null, 2)}</pre>
            </section>
            <section aria-label="Signature" className="min-w-0 space-y-1.5 rounded-md border border-warning/40 p-3">
              <h4 className="text-xs font-semibold text-warning">Signature</h4>
              <p className="font-mono text-xs break-all">{decoded.parts[2] || "(empty)"}</p>
              <p className="text-xs text-muted-foreground">Decoding does not check it. Only verification does.</p>
            </section>
          </div>

          <dl className="space-y-2">
            {claimRows.map((c) => {
              const when = timeLabel(c.name, c.value, now);
              return (
                <div key={`${c.where}-${c.name}`} data-testid={`claim-${c.name}`} title={CLAIMS[c.name]} className="rounded-md border p-2 text-sm">
                  <dt className="flex flex-wrap items-baseline gap-2">
                    <code className={`font-mono text-xs font-semibold ${c.where === "header" ? "text-brand" : "text-success"}`}>{c.name}</code>
                    <span className="font-mono text-xs break-all">{show(c.value)}</span>
                    {when && <span className="text-xs font-medium">{when}</span>}
                  </dt>
                  <dd className="text-xs text-muted-foreground">{CLAIMS[c.name]}</dd>
                </div>
              );
            })}
          </dl>

          <div className="space-y-2 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" size="sm" disabled={check.state === "busy"} onClick={() => void verify()}>
                Verify with lab JWKS
              </Button>
              <LabSwitcher />
            </div>
            <p className="text-xs text-muted-foreground">
              Fetches {labBase("02", impl)}/.well-known/jwks.json and checks the signature with RS256 pinned, issuer {ISSUER} and audience {AUDIENCE}.
            </p>
            {check.state === "valid" && (
              <p role="status" className="text-sm font-medium text-success">
                Signature valid (RS256, kid {check.kid}). Issuer, audience and expiry also passed.
              </p>
            )}
            {check.state === "failed" && (
              <p role="status" className="text-sm text-destructive">
                Verification failed: {check.message}
              </p>
            )}
            {check.state === "offline" && <OfflineCard lab="02" impl={impl} retrying={false} />}
          </div>
        </>
      )}
    </div>
  );
}
