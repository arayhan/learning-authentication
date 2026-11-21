import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from "node:crypto";

/**
 * The ONE signing key of this lab. Both implementations load the same lab02.keys row, so a token signed by TS
 * verifies in Go and the other way round. The PEM strings are stored and used verbatim.
 */
export type Keys = {
  kid: string;
  privatePem: string; // PKCS#8 "PRIVATE KEY"
  publicPem: string; // SPKI "PUBLIC KEY"; also (deliberately, for the key-confusion demo) the naive HS256 secret
  privateKey: KeyObject;
  publicKey: KeyObject;
};

/** First 16 chars of base64url(sha256(DER SPKI)): same recipe in the Go lab. */
export const kidFromPublicPem = (publicPem: string) =>
  createHash("sha256").update(createPublicKey(publicPem).export({ type: "spki", format: "der" })).digest("base64url").slice(0, 16);

/** Fresh RSA-2048 pair as PEM text (LF endings, trailing newline). */
export function generatePems() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { kid: kidFromPublicPem(publicKey), privatePem: privateKey, publicPem: publicKey };
}

/** Rebuilds Keys from a stored row (the stored kid and PEM strings win; nothing is re-encoded). */
export function loadKeys(kid: string, privatePem: string, publicPem: string): Keys {
  return { kid, privatePem, publicPem, privateKey: createPrivateKey(privatePem), publicKey: createPublicKey(publicPem) };
}

// JWK field order matches the contract: kty, n, e, kid, alg, use.
export function jwks(k: Keys) {
  const { n, e } = k.publicKey.export({ format: "jwk" });
  return { keys: [{ kty: "RSA", n, e, kid: k.kid, alg: "RS256", use: "sig" }] };
}
