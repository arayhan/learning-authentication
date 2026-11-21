"use client";

import { ChevronLeft, ChevronRight, Database, Globe, KeyRound, type LucideIcon, Pause, Play, RotateCcw, ServerCog, ShieldAlert, User, Waypoints } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { MessageDrawer } from "./MessageDrawer";
import type { Actor, Flow, FlowStep } from "./types";

const COL = 160; // fixed actor column: the SVG's intrinsic width is actors x COL, so narrow screens scroll inside the wrapper
const HEADER = 56;
const ROW = 56;
const PLAY_MS = 1600;
const ICONS: Record<Actor["kind"], LucideIcon> = { user: User, browser: Globe, server: ServerCog, db: Database, attacker: ShieldAlert, as: KeyRound, api: Waypoints };

const subscribeNever = () => () => {};

const tone = (s: FlowStep, isCurrent: boolean) =>
  s.danger ? { stroke: "stroke-destructive", fill: "fill-destructive" } : isCurrent ? { stroke: "stroke-primary", fill: "fill-primary" } : { stroke: "stroke-muted-foreground", fill: "fill-muted-foreground" };

function Arrow({ step, index, x1, x2, y, isCurrent, animate, onOpen }: { step: FlowStep; index: number; x1: number; x2: number; y: number; isCurrent: boolean; animate: boolean; onOpen?: () => void }) {
  const t = tone(step, isCurrent);
  const self = x1 === x2;
  const dir = x2 >= x1 ? 1 : -1;
  const line = self ? `M ${x1} ${y - 8} h 28 v 16 h -28` : `M ${x1} ${y} L ${x2 - dir * 2} ${y}`;
  const head = self ? `M ${x1 + 6} ${y + 4} L ${x1} ${y + 8} L ${x1 + 6} ${y + 12}` : `M ${x2 - dir * 8} ${y - 4} L ${x2} ${y} L ${x2 - dir * 8} ${y + 4}`;
  const fade = animate ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.3, duration: 0.1 } } : {};
  const draw = animate ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.35, ease: "easeOut" as const } } : {};
  const w = isCurrent ? 2 : 1.5;
  const interactive = !!step.http;
  const tx = self ? x1 + 36 : (x1 + x2) / 2;
  const left = Math.min(x1, x2) - 8;
  return (
    <g
      data-step={index}
      aria-current={isCurrent ? "step" : undefined}
      aria-label={`${index + 1}. ${step.label}${interactive ? ". Lihat raw message" : ""}`}
      role={interactive ? "button" : "img"}
      tabIndex={interactive ? 0 : undefined}
      className={interactive ? "cursor-pointer outline-none [&:focus-visible_rect]:stroke-ring" : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen?.();
        }
      }}
    >
      {interactive && <rect x={left} y={y - 24} width={(self ? 36 : Math.abs(x2 - x1)) + 16} height={36} rx={6} fill="transparent" strokeWidth={2} className="stroke-transparent" />}
      <motion.path d={line} fill="none" strokeWidth={w} strokeLinecap="round" className={t.stroke} {...draw} />
      <motion.path d={head} fill="none" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" className={t.stroke} {...fade} />
      <text
        x={tx}
        y={self ? y - 12 : y - 8}
        textAnchor={self ? "start" : "middle"}
        className={`font-sans text-[12px] ${t.fill} stroke-background`}
        style={{ paintOrder: "stroke", strokeWidth: 4, textDecoration: interactive ? "underline dotted" : undefined }}
      >
        {step.label}
      </text>
    </g>
  );
}

export function SequenceFlow({ flow }: { flow: Flow }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const reduced = useReducedMotion() ?? false;
  // false during SSR and the hydration render, true after: keeps server and first client markup identical (arrows fully visible), so reduced-motion users never hydrate into a hidden arrow.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const last = flow.steps.length - 1;

  // Advance one step per tick. Reduced motion only drops the draw animation, never the auto-advance.
  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      const next = Math.min(last, step + 1);
      setStep(next);
      if (next >= last) setPlaying(false);
    }, PLAY_MS);
    return () => clearTimeout(id);
  }, [playing, step, last]);

  const go = (n: number) => {
    setPlaying(false);
    setStep(Math.min(last, Math.max(0, n)));
  };
  const play = () => {
    if (last < 1) return;
    if (playing) return setPlaying(false);
    if (step >= last) setStep(0);
    setPlaying(true);
  };

  const xOf = (id: string) => Math.max(0, flow.actors.findIndex((a) => a.id === id)) * COL + COL / 2;
  const width = flow.actors.length * COL;
  const height = HEADER + (flow.steps.length + 0.5) * ROW;
  const cur = flow.steps[step];
  if (!cur) return <p className="max-w-3xl rounded-lg border bg-card p-3 text-sm text-muted-foreground">Flow ini belum punya langkah.</p>;
  const opened = open === null ? null : flow.steps[open];

  return (
    <>
      <div
        role="group"
        aria-label={flow.title}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.altKey || e.metaKey || e.ctrlKey || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
          e.preventDefault();
          go(step + (e.key === "ArrowRight" ? 1 : -1));
        }}
        className="max-w-3xl space-y-3 rounded-lg border bg-card p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="overflow-x-auto">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto block max-w-none" role="presentation">
            {flow.actors.map((a, i) => {
              const Icon = ICONS[a.kind];
              const cx = i * COL + COL / 2;
              return (
                <g key={a.id}>
                  <line x1={cx} x2={cx} y1={HEADER - 8} y2={height} strokeWidth={1} className="stroke-border" />
                  <rect x={cx - 60} y={8} width={120} height={32} rx={8} className="fill-muted stroke-border" />
                  <Icon x={cx - 50} y={16} width={16} height={16} aria-hidden className="stroke-muted-foreground" />
                  <text x={cx - 28} y={28} className="fill-foreground font-sans text-[12px] font-medium">
                    {a.label}
                  </text>
                </g>
              );
            })}
            {flow.steps.slice(0, step + 1).map((s, i) => (
              <Arrow
                key={i}
                step={s}
                index={i}
                x1={xOf(s.from)}
                x2={xOf(s.to)}
                y={HEADER + ROW * (i + 0.7)}
                isCurrent={i === step}
                animate={mounted && !reduced && i === step}
                onOpen={s.http ? () => setOpen(i) : undefined}
              />
            ))}
          </svg>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon-sm" aria-label="Mundur" disabled={step === 0} onClick={() => go(step - 1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Maju" disabled={step === last} onClick={() => go(step + 1)}>
            <ChevronRight />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label={playing ? "Jeda" : "Putar"} disabled={last < 1} onClick={play}>
            {playing ? <Pause /> : <Play />}
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Reset" onClick={() => go(0)}>
            <RotateCcw />
          </Button>
          <span aria-live="polite" className="ml-1 text-sm text-muted-foreground tabular-nums">
            Langkah {step + 1} dari {flow.steps.length}
          </span>
        </div>
        <p className={`min-h-6 text-sm ${cur.danger ? "text-destructive" : ""}`}>{cur.note}</p>
      </div>
      {opened?.http && <MessageDrawer open onOpenChange={(o) => !o && setOpen(null)} title={opened.label} http={opened.http} />}
    </>
  );
}
