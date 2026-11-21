import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const LOCAL_EMAIL = "you@local";

// shortcut: one built-in local profile, no login (single-user local learning app); add real auth if it ever goes multi-user
export async function currentUser() {
  await db.insert(users).values({ email: LOCAL_EMAIL, displayName: "You", passwordHash: "" }).onConflictDoNothing();
  const [u] = await db.select({ id: users.id, email: users.email, displayName: users.displayName }).from(users).where(eq(users.email, LOCAL_EMAIL));
  return u;
}
