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

const KEY_HEADERS = ["content-type", "location", "set-cookie", "www-authenticate", "cache-control"];

/** Fires requests at the selected lab implementation and shows the response inline. */
export function LabConsole({ lab, actions }: { lab: LabId; actions: ConsoleAction[] }) {
  const [impl] = useLabImpl();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (a: ConsoleAction) => {
    setBusy(true);
    try {
      const headers: Record<string, string> = { ...a.headers };
      if (a.body !== undefined) headers["Content-Type"] ??= "application/json";
      if (a.vulnerable) headers["X-Lab-Mode"] = "vulnerable";
      const res = await fetch(`${labBase(lab, impl)}${a.path}`, {
        method: a.method,
        headers,
        body: a.body === undefined ? undefined : typeof a.body === "string" ? a.body : JSON.stringify(a.body),
        credentials: "include",
      });
      const text = await res.text();
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
