import { useSyncExternalStore } from "react";
import { labs, type Impl } from "@/lib/labs";

// RFC 7636 Appendix B: the worked example every PKCE implementation is checked against.
export const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
export const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

// RFC 7636 section 4.1: 43 to 128 characters of the unreserved set.
export const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

/** The lab's client SPA sits 10 ports above the authorization server (go 4113, ts 4213). */
export const clientBase = (impl: Impl) => `http://localhost:${labs["03"].ports[impl] + 10}`;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

/** 32 random bytes as base64url: 43 characters, the shortest verifier RFC 7636 allows. */
export const randomVerifier = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

const boots = new Map<string, string>();
const noSubscribe = () => () => {};
/** A random value that is "" on the server and while hydrating, then fixed for the life of the page. Avoids a setState in an effect and a hydration mismatch. */
export const useBootRandom = (key: string, make: () => string) =>
  useSyncExternalStore(
    noSubscribe,
    () => {
      let v = boots.get(key);
      if (v === undefined) boots.set(key, (v = make()));
      return v;
    },
    () => "",
  );

/** S256 step by step: the ASCII bytes, their SHA-256 digest, and the base64url of the digest. */
export async function s256(verifier: string) {
  const bytes = new TextEncoder().encode(verifier);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return { bytesHex: hex(bytes), digestHex: hex(digest), challenge: b64url(digest) };
}

export type AuthorizeParams = {
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
  vulnerable: boolean;
};

/** Ordered parameters of the /authorize request. An empty challenge sends no PKCE parameters at all. */
export function authorizeEntries(p: AuthorizeParams): [string, string][] {
  return [
    ["response_type", "code"],
    ["client_id", p.client_id],
    ["redirect_uri", p.redirect_uri],
    ["scope", p.scope],
    ["state", p.state],
    ...(p.code_challenge ? ([["code_challenge", p.code_challenge], ["code_challenge_method", "S256"]] as [string, string][]) : []),
    ...(p.vulnerable ? ([["lab_mode", "vulnerable"]] as [string, string][]) : []),
  ];
}

// encodeURIComponent, not URLSearchParams: a space in scope must be %20, never "+".
export const authorizeUrl = (base: string, p: AuthorizeParams) =>
  `${base}/authorize?${authorizeEntries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
