import { hash, verify } from "@node-rs/argon2";

// Same Argon2id parameters as the Go lab and the academy: m=19456 KiB, t=2, p=1 (16-byte salt, 32-byte hash by default).
// The PHC string uses the standard base64 alphabet without padding, which is what Go's base64.RawStdEncoding reads.
const opts = { algorithm: 2 /* Argon2id; const enum unusable under isolatedModules */, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (password: string) => hash(password, opts);

/** Verifies using the parameters inside the PHC string; anything malformed simply does not verify. */
export async function verifyPassword(phc: string, password: string): Promise<boolean> {
  try {
    return await verify(phc, password);
  } catch {
    return false;
  }
}

let dummy: string | undefined;

/** Runs once at startup; main exits if it throws (no lazy cache, no empty fallback). */
export async function initDummyHash(): Promise<void> {
  dummy = await hashPassword("dummy-password-for-timing");
}

/** Burns the same argon2 time as a real check, so an unknown email costs what a wrong password does. */
export async function dummyVerify(password: string): Promise<void> {
  if (!dummy) throw new Error("initDummyHash() was not called");
  await verifyPassword(dummy, password);
}
