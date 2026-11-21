import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/auth/origin";
import { hashPassword } from "@/lib/auth/password";
import { createSession, sessionCookie } from "@/lib/auth/session";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Invalid email");
  if (!displayName || displayName.length > 80) return bad("Display name is required");
  if (password.length < 8 || password.length > 256) return bad("Password must be at least 8 characters");

  const [user] = await db
    .insert(users)
    .values({ email, displayName, passwordHash: await hashPassword(password) })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  if (!user) return bad("Email already registered", 409);

  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json({ ok: true }, { status: 201 });
  res.cookies.set(sessionCookie(token, expiresAt));
  return res;
}
