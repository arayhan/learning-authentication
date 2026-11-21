import { hash, verify } from "@node-rs/argon2";

const opts = { algorithm: 2 /* Argon2id; const enum unusable under isolatedModules */, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (pw: string) => hash(pw, opts);

export async function verifyPassword(h: string, pw: string) {
  try {
    return await verify(h, pw);
  } catch {
    return false;
  }
}
