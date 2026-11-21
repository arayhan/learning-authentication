import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";

export const SESSION_COOKIE = "academy_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined) {
  if (!token) return null;
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sha256(token)));
  if (!row || row.expiresAt <= new Date()) return null;
  return { id: row.id, email: row.email, displayName: row.displayName };
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function currentUser() {
  return getSessionUser((await cookies()).get(SESSION_COOKIE)?.value);
}

export const sessionCookie = (token: string, expiresAt: Date) => ({
  name: SESSION_COOKIE,
  value: token,
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  expires: expiresAt,
});
