import { traceMiddleware, type Hub } from "@academy/trace";
import { Hono, type Context } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cors, err, jsonNotFound, limitBody } from "./http.ts";
import { AUDIENCE, ISSUER } from "./as.ts";
import type { Store } from "./store.ts";

const LEEWAY = 30; // seconds of clock-skew tolerance
const SCOPE_PHOTOS = "photos.read";

// RFC 6750: no credentials at all → bare `Bearer`; a bad token → error="invalid_token".
const bearerUnauthorized = (c: Context, hadToken: boolean) => {
  c.header("WWW-Authenticate", hadToken ? 'Bearer error="invalid_token"' : "Bearer");
  return err(c, 401, hadToken ? "invalid_token" : "unauthorized");
};

/** The resource server. It shares the DB only to see revocations; keys come from the AS over HTTP. */
export function createApiApp(store: Store, hub: Hub, asBase: string) {
  const app = new Hono();
  // The API learns the AS's public key by fetching its JWKS (never from lab03.keys) and trusts it for 5 minutes.
  // An unknown kid triggers a refetch, but not more often than every 30 seconds.
  const jwksSet = createRemoteJWKSet(new URL(`${asBase}/.well-known/jwks.json`), { cacheMaxAge: 5 * 60_000, cooldownDuration: 30_000 });

  app.use("*", cors);
  app.use("*", limitBody);
  app.use("*", traceMiddleware(hub, { lab: "03", impl: "ts", role: "api" }));
  jsonNotFound(app);

  app.get("/healthz", (c) => c.json({ ok: true }));

  app.get("/api/photos", async (c) => {
    c.header("Cache-Control", "no-store");
    const m = /^(\S+)\s+(.*)$/.exec(c.req.header("authorization") ?? "");
    const token = m?.[2]?.trim();
    if (m?.[1]?.toLowerCase() !== "bearer" || !token) return bearerUnauthorized(c, false);

    let claims;
    try {
      // RS256 is pinned (the token's own alg is never trusted); exp is required; iss and aud must match.
      ({ payload: claims } = await jwtVerify(token, jwksSet, { algorithms: ["RS256"], issuer: ISSUER, audience: AUDIENCE, clockTolerance: LEEWAY, requiredClaims: ["exp"] }));
    } catch {
      // shortcut: an unreachable AS also lands here as 401; a real API would answer 503 and alert
      return bearerUnauthorized(c, true);
    }
    if (typeof claims.jti === "string" && claims.jti !== "" && (await store.revoked(claims.jti))) return bearerUnauthorized(c, true); // code reuse revoked this token at the AS

    const scope = typeof claims.scope === "string" ? claims.scope : "";
    if (!scope.split(/\s+/).includes(SCOPE_PHOTOS)) {
      c.header("WWW-Authenticate", 'Bearer error="insufficient_scope", scope="photos.read"');
      return err(c, 403, "insufficient_scope");
    }
    return c.json({ photos: [{ id: 1, title: "Sunrise over the bay" }, { id: 2, title: "Harbour at dusk" }, { id: 3, title: "Mountain ridge" }] });
  });

  return app;
}
