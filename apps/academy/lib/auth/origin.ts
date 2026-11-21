// CSRF guard for cookie-authenticated POSTs: reject when Origin is present and not our host.
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("host") ?? new URL(req.url).host;
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {}
  if (originHost !== host) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
}
