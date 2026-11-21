const DAY = 86_400_000;

export function streakDays(dates: Date[], timeZone: string, now: Date): number {
  const key = (d: Date, tz: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  let tz = timeZone;
  try { key(now, tz); } catch { tz = "UTC"; }

  const days = new Set(dates.map((d) => key(d, tz)));
  // Walk calendar keys via UTC midnight of the local date, so DST never skips or repeats a day.
  const today = Date.parse(`${key(now, tz)}T00:00:00Z`);
  const at = (n: number) => new Date(today - n * DAY).toISOString().slice(0, 10);
  const start = days.has(at(0)) ? 0 : days.has(at(1)) ? 1 : -1;
  if (start < 0) return 0;
  let n = 0;
  while (days.has(at(start + n))) n++;
  return n;
}
