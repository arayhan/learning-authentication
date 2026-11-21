"use client";

import Link from "next/link";
import { LevelBadge } from "@/components/game/LevelBadge";
import { useProgress } from "@/components/game/ProgressProvider";
import { StreakChip } from "@/components/game/StreakChip";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ userName }: { userName: string }) {
  const { state } = useProgress();

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link href="/" className="rounded-md text-sm font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Auth Academy
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 sm:flex">
            <LevelBadge name={state.level.name} />
            <StreakChip days={state.streak} />
          </span>
          <span className="hidden max-w-40 truncate text-sm text-muted-foreground md:inline">{userName}</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
