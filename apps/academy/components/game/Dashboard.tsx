"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { BadgeShelf } from "./BadgeShelf";
import { LevelBadge } from "./LevelBadge";
import { useProgress } from "./ProgressProvider";
import { SkillMap } from "./SkillMap";
import { lessonUrl, nextLesson } from "./skill-state";
import { StreakChip } from "./StreakChip";
import { XpBar } from "./XpBar";

export function Dashboard({ name }: { name: string }) {
  const { state } = useProgress();
  const next = nextLesson(state.completed);
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Selamat datang lagi, {name}</h1>
          <p className="text-sm text-muted-foreground">Belajar authentication dengan cara bikin dan bobol sendiri.</p>
        </div>
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge name={state.level.name} />
            <StreakChip days={state.streak} />
          </div>
          <XpBar xp={state.xp} level={state.level} />
        </div>
        {next ? (
          <Link href={lessonUrl(next)} className={buttonVariants({ size: "lg" })}>
            Lanjut: {next.title}
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Course selesai. Buka lagi lesson mana pun dari peta di bawah.</p>
        )}
      </section>
      <SkillMap completed={state.completed} />
      <BadgeShelf earned={state.badges} />
    </div>
  );
}
