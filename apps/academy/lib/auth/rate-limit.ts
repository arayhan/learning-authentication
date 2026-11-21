const hits = new Map<string, number[]>();

// shortcut: in-memory, resets on restart; move to Postgres/Redis if academy is ever multi-instance
export function rateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterMs: recent[0] + windowMs - now };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterMs: 0 };
}
