"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LabId } from "@/lib/course/types";
import { labs, type Impl } from "@/lib/labs";

/** Shown when the lab's trace stream is down. The stream reconnects on its own, so this only needs the start command. */
export function OfflineCard({ lab, impl, retrying = true }: { lab: LabId; impl: Impl; retrying?: boolean }) {
  const [copied, setCopied] = useState(false);
  const cmd = labs[lab].startCmd(impl);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div role="status" className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">
        Lab {lab} ({impl === "go" ? "Go" : "TS"}) belum jalan
      </p>
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 font-mono text-xs">
        <code className="min-w-0 flex-1 truncate">{cmd}</code>
        <Button variant="ghost" size="icon-xs" onClick={copy} aria-label={`Salin ${cmd}`}>
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      {retrying && <p className="text-xs text-muted-foreground">Nyoba nyambung lagi…</p>}
    </div>
  );
}
