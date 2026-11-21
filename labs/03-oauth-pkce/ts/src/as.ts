import { sseHandler, traceMiddleware, type Hub } from "@academy/trace";
import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import { SignJWT } from "jose";
import { findClient, label, parseScope, redirectOk, secretOk, subset } from "./clients.ts";
import { cors, err, jsonNotFound, limitBody, vulnerableHeader } from "./http.ts";
import { consentPage, errorPage, htmlResponse, loginPage } from "./pages.ts";
import { dummyVerify, verifyPassword } from "./password.ts";
import { CHALLENGE_RE, newToken, safeEqual } from "./pkce.ts";
import { jwks, type Keys } from "./keys.ts";
import type { Store } from "./store.ts";

export const ISSUER = "http://localhost:4103"; // the same string in the Go lab, whatever port that one listens on
export const AUDIENCE = "lab03-api";
export const ACCESS_TTL = 300; // seconds
const SESSION_TTL_MS = 8 * 3600_000;
const PENDING_TTL_MS = 10 * 60_000;

/** A logged-in user at the authorization server (not at the client app). */
type Session = { userId: string; csrf: string; exp: number };

/**
 * An authorization request that passed validation and is waiting for login and consent. It lives on the server,
 * keyed by a random id: the browser only ever carries that id, never the parameters, so the forms cannot be
 * edited to change the client, redirect_uri, scope or challenge.
 */
type Pending = { clientId: string; redirectUri: string; scope: string; state: string; challenge: string | null; session: string; exp: number };

/** Signs an RS256 access token. The kid header tells verifiers which JWKS key to use. */
export function issueAccess(k: Keys, sub: string, clientId: string, scope: string, jti: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  return new SignJWT({ client_id: clientId, scope })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: k.kid })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TTL)
    .setJti(jti)
    .sign(k.privateKey);
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const mediaType = (c: Context) => (c.req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();

/** The urlencoded body, or an empty form when the request is not one. */
async function form(c: Context): Promise<URLSearchParams> {
  return mediaType(c) === "application/x-www-form-urlencoded" ? new URLSearchParams(await c.req.text()) : new URLSearchParams();
}

export function createAsApp(store: Store, hub: Hub) {
  const app = new Hono();
  const { keys } = store;

  // shortcut: in-memory AS sessions, fine for a single-process lab
  const sessions = new Map<string, Session>();
  const pend = new Map<string, Pending>();

  const sweep = (m: Map<string, { exp: number }>) => {
    for (const [k, v] of m) if (Date.now() > v.exp) m.delete(k);
  };
  const sessionFrom = (c: Context): { sid: string; sess: Session } | undefined => {
    const sid = getCookie(c, "as_sid");
    const sess = sid ? sessions.get(sid) : undefined;
    return sid && sess && Date.now() < sess.exp ? { sid, sess } : undefined;
  };
  const livePending = (rid: string) => {
    const p = pend.get(rid);
    return p && Date.now() < p.exp ? p : undefined;
  };
  /** Single use, and only for the session the request is bound to. */
  const consumePending = (rid: string, sid: string) => {
    const p = livePending(rid);
    if (!p || !p.session || p.session !== sid) return undefined;
    pend.delete(rid);
    return p;
  };

  app.use("*", cors);
  app.use("*", limitBody);
  app.use("*", traceMiddleware(hub, { lab: "03", impl: "ts", role: "as" }));
  jsonNotFound(app);

  app.get("/healthz", (c) => c.json({ ok: true }));
  app.get("/__trace", sseHandler(hub));
  app.get("/.well-known/jwks.json", (c) => c.json(jwks(keys)));

  // ---- /authorize, /login, /consent ----

  /** Sends the browser back to the (already validated) redirect_uri with extra query parameters. */
  const redirectTo = (c: Context, redirectUri: string, state: string, params: Record<string, string>) => {
    let u: URL;
    try {
      u = new URL(redirectUri);
    } catch {
      return htmlResponse(c, 400, errorPage("Invalid request", "The redirect URI cannot be used."));
    }
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    if (state) u.searchParams.set("state", state);
    c.header("Cache-Control", "no-store");
    return c.redirect(u.toString(), 302);
  };

  /**
   * Validates in the order of RFC 6749 §4.1.2.1: first the two things that make a redirect unsafe (client_id,
   * redirect_uri), which get an error PAGE and no redirect; only then errors that are reported to the client by
   * redirecting back with ?error=…&state=….
   */
  app.get("/authorize", (c) => {
    const q = new URL(c.req.url).searchParams;
    // lab_mode in the QUERY: a browser navigation cannot add the X-Lab-Mode header.
    const vuln = q.get("lab_mode") === "vulnerable";
    const redirectUri = q.get("redirect_uri") ?? "";
    const client = findClient(q.get("client_id") ?? "");
    if (!client || !client.grants.includes("authorization_code") || !redirectOk(client, redirectUri, vuln)) {
      return htmlResponse(c, 400, errorPage("Invalid request", "The client or the redirect URI is not registered."));
    }
    const state = q.get("state") ?? "";
    const fail = (code: string) => redirectTo(c, redirectUri, state, { error: code });

    if (q.get("response_type") !== "code") return fail("unsupported_response_type");
    // PKCE is required, S256 only. The vulnerable mode lets a request with no PKCE parameters through.
    const cc = q.get("code_challenge") ?? "";
    const method = q.get("code_challenge_method") ?? "";
    let challenge: string | null = null;
    if (!vuln || cc !== "" || method !== "") {
      if (method !== "S256" || !CHALLENGE_RE.test(cc)) return fail("invalid_request");
      challenge = cc;
    }
    const scopes = parseScope(q.get("scope") ?? "");
    if (scopes.length === 0 || !subset(scopes, client.scopes)) return fail("invalid_scope");

    sweep(pend);
    const rid = newToken();
    const found = sessionFrom(c);
    pend.set(rid, { clientId: client.id, redirectUri, scope: scopes.join(" "), state, challenge, session: found?.sid ?? "", exp: Date.now() + PENDING_TTL_MS });
    return found
      ? htmlResponse(c, 200, consentPage(label(client), rid, found.sess.csrf, scopes))
      : htmlResponse(c, 200, loginPage(label(client), rid));
  });

  app.post("/login", async (c) => {
    const f = await form(c);
    const rid = f.get("rid") ?? "";
    const p = livePending(rid);
    const expired = () => htmlResponse(c, 400, errorPage("Invalid request", "This sign-in request has expired. Start again from the app."));
    if (!p || p.session) return expired();
    const client = findClient(p.clientId)!;
    const email = (f.get("email") ?? "").trim().toLowerCase();
    const password = f.get("password") ?? "";
    const user = await store.findUser(email);
    if (!user) await dummyVerify(password); // same cost as a real verify: unknown email must not be timing-distinguishable
    if (!user || !(await verifyPassword(user.phc, password))) {
      return htmlResponse(c, 401, loginPage(label(client), rid, "Invalid email or password.")); // identical for unknown email and wrong password
    }
    if (p.session || !livePending(rid)) return expired(); // someone else took the request while we hashed
    sweep(sessions);
    const sid = newToken();
    const sess: Session = { userId: user.id, csrf: newToken(), exp: Date.now() + SESSION_TTL_MS };
    sessions.set(sid, sess);
    p.session = sid;
    c.header("Set-Cookie", `as_sid=${sid}; Path=/; HttpOnly; SameSite=Lax`, { append: true });
    return htmlResponse(c, 200, consentPage(label(client), rid, sess.csrf, p.scope.split(" ")));
  });

  app.post("/consent", async (c) => {
    const f = await form(c);
    // 1. Who is asking, and did the consent page they came from belong to them? (CSRF)
    const found = sessionFrom(c);
    if (!found || !safeEqual(f.get("csrf") ?? "", found.sess.csrf)) return htmlResponse(c, 403, errorPage("Forbidden", "Missing or invalid form token."));
    const decision = f.get("decision");
    if (decision !== "approve" && decision !== "deny") return htmlResponse(c, 400, errorPage("Invalid request", "Unknown decision."));
    // 2. The pending request is taken exactly once, and only by the session it was created for.
    const p = consumePending(f.get("rid") ?? "", found.sid);
    if (!p) return htmlResponse(c, 400, errorPage("Invalid request", "This authorization request has expired or was already answered."));
    if (decision === "deny") return redirectTo(c, p.redirectUri, p.state, { error: "access_denied" });
    const code = newToken();
    await store.saveCode(code, { clientId: p.clientId, redirectUri: p.redirectUri, scope: p.scope, userId: found.sess.userId, challenge: p.challenge });
    return redirectTo(c, p.redirectUri, p.state, { code });
  });

  // ---- /token ----

  /** RFC 6749 §5.1 requires these two headers on every token response, success or error. */
  const tokenJson = (c: Context, status: 200 | 400 | 401, body: object) => {
    c.header("Cache-Control", "no-store");
    c.header("Pragma", "no-cache");
    return c.json(body, status);
  };
  const tokenError = (c: Context, status: 400 | 401, code: string) => {
    if (code === "invalid_client") c.header("WWW-Authenticate", 'Basic realm="lab03"');
    return tokenJson(c, status, { error: code });
  };
  const tokenOk = (c: Context, access_token: string, scope: string) => tokenJson(c, 200, { access_token, token_type: "Bearer", expires_in: ACCESS_TTL, scope });

  /** Redeems a code and answers with the token response. Shared with the attack helper. */
  async function exchange(c: Context, clientId: string, code: string, redirectUri: string, verifier: string) {
    const jti = newToken();
    const r = await store.redeem(code, clientId, redirectUri, verifier, jti);
    if ("error" in r) return tokenError(c, 400, r.error);
    return tokenOk(c, await issueAccess(keys, r.userId, clientId, r.scope, jti), r.scope);
  }

  app.post("/token", async (c) => {
    // The X-Lab-Mode header changes nothing here on purpose: the token rules (PKCE verifier for a code that has a
    // challenge, exact redirect_uri, single use) are the same in every mode. The weakness is created at /authorize.
    if (mediaType(c) !== "application/x-www-form-urlencoded") return tokenError(c, 400, "invalid_request");
    const f = await form(c);
    switch (f.get("grant_type") ?? "") {
      case "":
        return tokenError(c, 400, "invalid_request");
      case "authorization_code": {
        const clientId = f.get("client_id") ?? "";
        if (!clientId) return tokenError(c, 400, "invalid_request");
        const client = findClient(clientId);
        if (!client) return tokenError(c, 401, "invalid_client");
        if (!client.grants.includes("authorization_code")) return tokenError(c, 400, "unauthorized_client");
        const code = f.get("code") ?? "";
        const redirectUri = f.get("redirect_uri") ?? "";
        if (!code || !redirectUri) return tokenError(c, 400, "invalid_request");
        return exchange(c, client.id, code, redirectUri, f.get("code_verifier") ?? "");
      }
      case "client_credentials": {
        const m = /^basic\s+(\S+)$/i.exec(c.req.header("authorization") ?? "");
        const creds = m ? Buffer.from(m[1]!, "base64").toString() : "";
        const i = creds.indexOf(":");
        const client = i < 0 ? undefined : findClient(creds.slice(0, i));
        if (!client || !client.grants.includes("client_credentials") || !secretOk(client, creds.slice(i + 1))) return tokenError(c, 401, "invalid_client");
        let scope = client.scopes;
        const raw = f.get("scope") ?? "";
        if (raw !== "") {
          const req = parseScope(raw);
          if (req.length === 0 || !subset(req, client.scopes)) return tokenError(c, 400, "invalid_scope");
          scope = req;
        }
        const jti = newToken();
        const granted = scope.join(" ");
        const access = await issueAccess(keys, client.id, client.id, granted, jti); // sub is the client itself: there is no user
        await store.recordClientToken(jti);
        return tokenOk(c, access, granted);
      }
      default:
        return tokenError(c, 400, "unsupported_grant_type");
    }
  });

  /**
   * Plays the malicious app that stole an authorization code from the redirect URL. It knows the code and the
   * redirect_uri it saw there, but not the PKCE verifier. 404 unless the request opted into vulnerable mode.
   */
  app.post("/__attack/intercept", async (c) => {
    if (!vulnerableHeader(c)) return err(c, 404, "not found");
    let body: unknown;
    try {
      body = mediaType(c) === "application/json" ? JSON.parse(await c.req.text()) : undefined;
    } catch {
      body = undefined;
    }
    const code = isObject(body) ? body.code : undefined;
    if (typeof code !== "string" || code === "") return tokenError(c, 400, "invalid_request");
    return exchange(c, "demo-spa", code, await store.codeRedirectUri(code), ""); // no verifier
  });

  return app;
}
