import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { POST as register } from "./register/route";
import { POST as login } from "./login/route";

const url = (p: string) => `http://localhost:3000/api/auth/${p}`;
const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(url(p), {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: JSON.stringify(body),
  });
const tokenOf = (res: Response) => /academy_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1];
const user = { email: "Ada@Example.com", password: "correct horse", displayName: "Ada" };

beforeEach(async () => {
  await db.execute(sql`truncate table users cascade`);
});

test("register → login → session stored hashed", async () => {
  const reg = await register(post("register", user));
  expect(reg.status).toBe(201);
  expect(reg.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  expect(reg.headers.get("set-cookie")).toMatch(/SameSite=lax/i);

  const res = await login(post("login", { email: "ada@example.com", password: user.password }));
  expect(res.status).toBe(200);
  const token = tokenOf(res)!;
  const ids = (await db.select().from(sessions)).map((s) => s.id);
  expect(ids).not.toContain(token);
  expect(ids).toContain(createHash("sha256").update(token).digest("hex"));
  expect((await getSessionUser(token))?.email).toBe("ada@example.com");
});

test("duplicate email → 409", async () => {
  await register(post("register", user));
  expect((await register(post("register", user))).status).toBe(409);
});

test("login with unknown email and wrong password return identical 401 body", async () => {
  await register(post("register", user));
  const a = await login(post("login", { email: "nobody@example.com", password: "whatever123" }));
  const b = await login(post("login", { email: "ada@example.com", password: "wrong-password" }));
  expect(a.status).toBe(401);
  expect(b.status).toBe(401);
  expect(await a.text()).toBe(await b.text());
});

test("login rotates: old cookie token no longer resolves", async () => {
  const reg = await register(post("register", user));
  const old = tokenOf(reg)!;
  expect(await getSessionUser(old)).not.toBeNull();
  const res = await login(
    post("login", { email: "ada@example.com", password: user.password }, { cookie: `academy_session=${old}` }),
  );
  expect(res.status).toBe(200);
  expect(await getSessionUser(old)).toBeNull();
  expect(await getSessionUser(tokenOf(res))).not.toBeNull();
});

test("cross-origin POST /api/auth/login → 403", async () => {
  const res = await login(
    post("login", { email: "a@b.co", password: "x" }, { origin: "http://evil.test" }),
  );
  expect(res.status).toBe(403);
});

test("password shorter than 8 chars → 400", async () => {
  const res = await register(post("register", { ...user, password: "short" }));
  expect(res.status).toBe(400);
});

test("6th login attempt for same email → 429", async () => {
  const body = { email: "rl@example.com", password: "nope-nope" };
  for (let i = 0; i < 5; i++) expect((await login(post("login", body))).status).toBe(401);
  expect((await login(post("login", body))).status).toBe(429);
});
