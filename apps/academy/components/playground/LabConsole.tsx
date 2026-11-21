"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LabId } from "@/lib/course/types";
import { labBase } from "@/lib/labs";
import { useLabImpl } from "./LabImpl";
import { LabSwitcher } from "./LabSwitcher";
import { OfflineCard } from "./OfflineCard";
import { pretty } from "./TraceDetail";

export type ConsoleAction = {
  label: string;
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  vulnerable?: boolean;
};

type Result = { label: string; status: number; headers: [string, string][]; body: string } | "offline";

const KEY_HEADERS = ["content-type", "location", "set-cookie", "www-authenticate", "cache-control", "retry-after"];
const CSRF = "{{csrfToken}}";
const RANDOM_EMAIL = "{{randomEmail}}";
const EMAIL = "{{email}}";
const uses = (a: ConsoleAction, placeholder: string) => JSON.stringify([a.headers, a.body]).includes(placeholder);
const newEmail = () => `learner-${[...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, "0")).join("")}@example.com`;

/** The `csrfToken` field of a JSON response body, if it has one. */
function csrfOf(text: string): string | null {
  try {
    const v = JSON.parse(text) as { csrfToken?: unknown };
    return typeof v?.csrfToken === "string" ? v.csrfToken : null;
  } catch {
    return null;
  }
}

/**
 * Fires requests at the selected lab implementation and shows the response inline. String values in an action's
 * `headers` and `body` may contain {{csrfToken}}: it is replaced by the last `csrfToken` this console received from
 * the selected implementation (a later response without one keeps it), or by "" before any login.
 * {{randomEmail}} becomes a fresh `learner-<8 hex>@example.com` generated at send time (and remembered by this
 * console instance); {{email}} is the last one generated, or "" before any.
 */
export function LabConsole({ lab, actions }: { lab: LabId; actions: ConsoleAction[] }) {
  const [impl] = useLabImpl();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [csrf, setCsrf] = useState<{ impl: string; token: string } | null>(null);
  const token = csrf?.impl === impl ? csrf.token : "";
  const [email, setEmail] = useState("");

  const run = async (a: ConsoleAction) => {
    setBusy(true);
    try {
      const fresh = uses(a, RANDOM_EMAIL) ? newEmail() : null;
      if (fresh) setEmail(fresh);
      const sub = (v: string) => v.replaceAll(CSRF, token).replaceAll(RANDOM_EMAIL, fresh ?? "").replaceAll(EMAIL, fresh ?? email);
      const headers: Record<string, string> = Object.fromEntries(Object.entries(a.headers ?? {}).map(([k, v]) => [k, sub(v)]));
      if (a.body !== undefined) headers["Content-Type"] ??= "application/json";
      if (a.vulnerable) headers["X-Lab-Mode"] = "vulnerable";
      const res = await fetch(`${labBase(lab, impl)}${a.path}`, {
        method: a.method,
        headers,
        body: a.body === undefined ? undefined : sub(typeof a.body === "string" ? a.body : JSON.stringify(a.body)),
        credentials: "include",
      });
      const text = await res.text();
      const newToken = csrfOf(text);
      if (newToken) setCsrf({ impl, token: newToken });
      setResult({
        label: a.label,
        status: res.status,
        headers: KEY_HEADERS.flatMap((k) => (res.headers.has(k) ? [[k, res.headers.get(k)!] as [string, string]] : [])),
        body: text ? pretty(text) : "",
      });
    } catch {
      setResult("offline");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Lab console</h3>
        <LabSwitcher />
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.label} variant="outline" size="sm" disabled={busy} onClick={() => run(a)}>
            <span className="font-mono text-xs text-muted-foreground">{a.method}</span>
            {a.label}
            {a.vulnerable && (
              <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                vulnerable mode
              </span>
            )}
          </Button>
        ))}
      </div>
      {!email && actions.some((a) => uses(a, EMAIL)) && <p className="text-xs text-muted-foreground">Register first</p>}
      {!token && actions.some((a) => uses(a, CSRF)) && <p className="text-xs text-muted-foreground">Log in first to get a CSRF token</p>}
      {result === "offline" && <OfflineCard lab={lab} impl={impl} retrying={false} />}
      {result && result !== "offline" && (
        <div aria-live="polite" className="space-y-2 rounded-md border bg-muted/30 p-3 font-mono text-xs">
          <p>
            <span className="text-muted-foreground">{result.label}: </span>
            <span className="font-semibold">{result.status}</span>
          </p>
          {result.headers.length > 0 && (
            <pre className="whitespace-pre-wrap break-all text-muted-foreground">{result.headers.map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>
          )}
          {result.body && <pre className="overflow-x-auto whitespace-pre-wrap break-all">{result.body}</pre>}
        </div>
      )}
    </div>
  );
}
