import { expect, test } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { rateLimit } from "./rate-limit";

test("hash is PHC argon2id and verifies", async () => {
  const h = await hashPassword("correct horse battery staple");
  expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  expect(await verifyPassword(h, "correct horse battery staple")).toBe(true);
  expect(await verifyPassword(h, "wrong")).toBe(false);
});

test("rateLimit blocks 6th attempt in window", () => {
  for (let i = 0; i < 5; i++) expect(rateLimit("k", { limit: 5, windowMs: 60_000 }).ok).toBe(true);
  expect(rateLimit("k", { limit: 5, windowMs: 60_000 }).ok).toBe(false);
});
