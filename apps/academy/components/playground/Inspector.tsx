"use client";

import { useState } from "react";
import { cn } from "cn";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LabId } from "@/lib/course/types";
import { useLabImpl } from "./LabImpl";
import { LabSwitcher } from "./LabSwitcher";
import { OfflineCard } from "./OfflineCard";
import { TraceDetail } from "./TraceDetail";
import { useTraceStream } from "./useTraceStream";

export const statusClass = (s: number) =>
  s >= 500
    ? "text-destructive"
    : s >= 400
      ? "text-warning"
      : s >= 300
        ? "text-brand"
        : "text-success";

/** Live HTTP timeline of one lab. Newest first; select a row for headers, cookies, body and raw text. */
export function Inspector({ lab }: { lab: LabId }) {
  const [impl] = useLabImpl();
  const { status, events, clear } = useTraceStream(lab, impl);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = [...events].reverse();
  const selected = events.find((e) => e.id === selectedId) ?? null;

  return (
    <section aria-label="HTTP Inspector" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LabSwitcher />
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className={cn("size-2 rounded-full", status === "online" ? "bg-success" : "bg-muted-foreground/50")} />
            {status === "online" ? "Live" : status === "connecting" ? "Menyambung" : "Offline"}
          </span>
          <Button
            variant="ghost"
            size="xs"
            disabled={!events.length}
            onClick={() => {
              clear();
              setSelectedId(null);
            }}
          >
            <Trash2 /> Hapus
          </Button>
        </div>
      </div>

      {status === "offline" && <OfflineCard lab={lab} impl={impl} />}

      {rows.length === 0 ? (
        status !== "offline" && <p className="text-xs text-muted-foreground">Belum ada request. Coba pakai lab-nya, nanti muncul di sini.</p>
      ) : (
        <ul aria-label="Daftar request" className="max-h-72 divide-y overflow-y-auto rounded-md border font-mono text-xs">
          {rows.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                aria-pressed={e.id === selectedId}
                onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                  e.id === selectedId && "bg-muted",
                )}
              >
                <span className="w-11 shrink-0 font-semibold">{e.req.method}</span>
                <span className="min-w-0 flex-1 truncate" title={e.req.path}>
                  {e.req.path}
                </span>
                <span className={cn("shrink-0 tabular-nums", statusClass(e.res.status))}>{e.res.status}</span>
                <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">{e.durationMs}ms</span>
                <span className="shrink-0 rounded border px-1 text-[10px] uppercase text-muted-foreground">{e.role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && <TraceDetail key={selected.id} event={selected} />}
    </section>
  );
}
