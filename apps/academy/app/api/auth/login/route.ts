import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/auth/origin";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/auth/rate-limit";
import { createSession, deleteSession, SESSION_COOKIE, sessionCookie } from "@/lib/auth/session";

// Verified against when the email is unknown, so timing doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;

const invalid = () => NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const rl = rateLimit(`login:${email}`, { limit: 5, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));
  dummyHash ??= hashPassword("dummy-password-for-timing");
  const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash), password);
  if (!user || !ok) return invalid();

  // Rotation: drop any pre-existing session before issuing a new one.
  const old = req.cookies.get(SESSION_COOKIE)?.value;
  if (old) await deleteSession(old);
  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(token, expiresAt));
  return res;
}
