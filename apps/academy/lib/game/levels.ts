const LEVELS = [
  { name: "Intern", min: 0 },
  { name: "Junior", min: 300 },
  { name: "Mid", min: 900 },
  { name: "Senior", min: 1800 },
  { name: "Staff", min: 2800 },
  { name: "Principal", min: 4000 },
];

export function levelFor(xp: number): { name: string; min: number; next: number | null } {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].min) i++;
  return { ...LEVELS[i], next: LEVELS[i + 1]?.min ?? null };
}
