import { safeEqual } from "./pkce.ts";

/** Static configuration: this lab has no client registration endpoint. */
export type Client = {
  id: string;
  name: string;
  secret?: string; // absent for a public client
  redirectUris: string[];
  scopes: string[]; // the most this client may ever be granted
  grants: string[];
};

export const clients: Record<string, Client> = {
  // demo-spa: a browser app. It cannot keep a secret, so PKCE is what protects its codes.
  "demo-spa": {
    id: "demo-spa", name: "Demo SPA",
    redirectUris: ["http://localhost:4113/callback", "http://localhost:4213/callback"],
    scopes: ["photos.read", "profile"],
    grants: ["authorization_code"],
  },
  // demo-backend: a server process with a secret and no user.
  "demo-backend": { id: "demo-backend", name: "Demo backend", secret: "lab-secret", redirectUris: [], scopes: ["photos.read"], grants: ["client_credentials"] },
};

/** Own-property lookup: "__proto__" and "constructor" are not clients. */
export const findClient = (id: string): Client | undefined => (Object.hasOwn(clients, id) ? clients[id] : undefined);

/** Friendly name plus the id the contract is written in. */
export const label = (c: Client) => `${c.name} (${c.id})`;

/**
 * EXACT string comparison against the registered URIs (RFC 6749 §3.1.2.3 / OAuth 2.1).
 * The vulnerable mode degrades it to a prefix match, which is how "…/callback/../evil" style bypasses happen.
 */
export const redirectOk = (c: Client, uri: string, vulnerable: boolean) =>
  c.redirectUris.some((registered) => (vulnerable ? uri.startsWith(registered) : uri === registered));

/** Constant time. A public client never matches. */
export const secretOk = (c: Client, secret: string) => c.secret !== undefined && safeEqual(c.secret, secret);

/** Splits a space-delimited scope, dropping duplicates. Empty result = no usable scope. */
export const parseScope = (s: string) => [...new Set(s.split(/\s+/).filter(Boolean))];

export const subset = (requested: string[], allowed: string[]) => requested.every((s) => allowed.includes(s));

/** The human text on the consent page. */
export const scopeInfo: Record<string, string> = {
  "photos.read": "View your photos",
  profile: "View your basic profile",
};
