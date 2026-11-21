import type { Flow } from "@/components/flow/types";

// Raw messages mirror the Lab 03 HTTP contract (labs/03-oauth-pkce): authorization server on :4103, the client SPA on
// :4113 and the resource API on :4123 (the TypeScript lab shifts all three by +100). The PKCE pair is the worked example
// from RFC 7636 Appendix B, so the numbers can be checked in the PkceGenerator. Tokens are shortened with an ellipsis.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const CODE = "Qm7vT2xK9pLw4Zr1HnB8cYsE5uJgA0dF3iOaXtRbVNk";
const CODE_ATT = "r5HcN0aYw8Ld2VqXe6TgJz1PbMs4KoUi9FtA3EnDxCy";
const STATE = "xK9mQ2vLp7Rt";
const ACCESS = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ii4uLiJ9.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQxMDMiLC4uLn0.…";
const AS = "Host: localhost:4103";
const API = "Host: localhost:4123";
const FORM = "Content-Type: application/x-www-form-urlencoded";
const CB = "http%3A%2F%2Flocalhost%3A4113%2Fcallback";
const SCOPE = "photos.read%20profile";
const CH = `code_challenge=${CHALLENGE}&code_challenge_method=S256`;

const authorizeReq = (extra: string, scope = SCOPE) =>
  `GET /authorize?response_type=code&client_id=demo-spa&redirect_uri=${CB}&scope=${scope}&state=${STATE}${extra} HTTP/1.1\n${AS}`;
const redirect302 = (code: string) => `HTTP/1.1 302 Found\nCache-Control: no-store\nLocation: http://localhost:4113/callback?code=${code}&state=${STATE}`;
const tokenReq = (code: string, verifier?: string) =>
  `POST /token HTTP/1.1\n${AS}\n${FORM}\n\ngrant_type=authorization_code&client_id=demo-spa&code=${code}&redirect_uri=${CB}${verifier ? `&code_verifier=${verifier}` : ""}`;
const tokenOk = `HTTP/1.1 200 OK\nContent-Type: application/json\nCache-Control: no-store\nPragma: no-cache\n\n{"access_token":"${ACCESS}","token_type":"Bearer","expires_in":300,"scope":"photos.read profile"}`;
const grant400 = `HTTP/1.1 400 Bad Request\nContent-Type: application/json\nCache-Control: no-store\nPragma: no-cache\n\n{"error":"invalid_grant"}`;
const photosReq = `GET /api/photos HTTP/1.1\n${API}\nAuthorization: Bearer ${ACCESS}`;
const photosOk = `HTTP/1.1 200 OK\nContent-Type: application/json\nCache-Control: no-store\n\n{"photos":[{"id":1,"title":"Sunrise over the bay"},{"id":2,"title":"Harbour at dusk"},{"id":3,"title":"Mountain ridge"}]}`;
const consentReq = `POST /consent HTTP/1.1\n${AS}\n${FORM}\nCookie: as_sid=bO3k…\n\nrid=Tn4y…&csrf=Wq8e…&decision=approve`;

const oauthRoles: Flow = {
  id: "oauthRoles",
  title: "The four roles: a photo app gets limited access to a user's photos",
  actors: [
    { id: "user", label: "Resource owner (user)", kind: "user" },
    { id: "client", label: "Client (photo app)", kind: "browser" },
    { id: "as", label: "Authorization server", kind: "as" },
    { id: "api", label: "Resource server (API)", kind: "api" },
  ],
  steps: [
    { from: "user", to: "client", label: "\"Show my photos\"", note: "The user wants the app to work with data that lives at another service. The user's password for that service must not go to the app." },
    { from: "client", to: "as", label: "ask for photos.read", http: authorizeReq(`&${CH}`, "photos.read"), note: "The app does not ask for a password. It sends the user to the authorization server and names the access it wants: the scope." },
    { from: "as", to: "user", label: "sign in + consent screen", note: "Only the authorization server ever sees the password. The consent page lists exactly what the app asks for." },
    { from: "user", to: "as", label: "approve", http: consentReq, note: "The user, not the app, decides. Denying returns error=access_denied to the app." },
    { from: "as", to: "client", label: "access token (photos.read only)", http: tokenOk, note: "A short-lived token that carries the granted scope. It is the valet key: it starts the car but does not open the trunk. (The code step in between is the next lesson.)" },
    { from: "client", to: "api", label: "GET /api/photos", http: photosReq, note: "The app presents the token as a bearer credential (RFC 6750)." },
    { from: "api", to: "client", label: "200 photos", http: photosOk, note: "The resource server verifies the token itself (signature, iss, aud, exp, scope) and answers. It never saw the user's password either." },
  ],
};

const authCode: Flow = {
  id: "authCode",
  title: "Authorization code flow: front channel for the code, back channel for the token",
  actors: [
    { id: "user", label: "User", kind: "user" },
    { id: "client", label: "Client (SPA)", kind: "browser" },
    { id: "as", label: "Authorization server", kind: "as" },
    { id: "api", label: "API", kind: "api" },
  ],
  steps: [
    { from: "client", to: "as", label: "GET /authorize (front channel)", http: authorizeReq(`&${CH}`), note: "The browser is redirected here. The query string says who is asking, where to return, what for, and a state value to check on return." },
    { from: "as", to: "user", label: "login + consent page", note: "The authorization server validates client_id and redirect_uri first. A bad value gets an error page and no redirect (RFC 6749 section 4.1.2.1)." },
    { from: "user", to: "as", label: "POST /consent: approve", http: consentReq, note: "The user signs in at the authorization server and approves. The lab's form carries an opaque request id and a CSRF token, not the original parameters." },
    { from: "as", to: "client", label: "302 to /callback?code=…", http: redirect302(CODE), note: "The code is a one-time ticket, valid 60 seconds in the lab, bound to the client and the redirect_uri. It travels through the browser URL, so it is not worth much alone." },
    { from: "client", to: "client", label: "check state", note: "The app compares state with the value it stored before leaving. A mismatch means the response is not for this request: drop it." },
    { from: "client", to: "as", label: "POST /token (back channel)", http: tokenReq(CODE, VERIFIER), note: "The app exchanges the code for tokens directly with the authorization server, not through the redirect. The access token never touches the URL." },
    { from: "as", to: "client", label: "200 access token", http: tokenOk, note: "RFC 6749 requires Cache-Control: no-store and Pragma: no-cache on every token response." },
    { from: "client", to: "api", label: "GET /api/photos", http: photosReq, note: "The app uses the token as a bearer credential." },
    { from: "api", to: "client", label: "200 photos", http: photosOk },
  ],
};

const implicitDeprecated: Flow = {
  id: "implicitDeprecated",
  title: "Why the implicit flow was retired: the token rode in the URL",
  actors: [
    { id: "browser", label: "SPA (browser)", kind: "browser" },
    { id: "as", label: "Authorization server", kind: "as" },
    { id: "attacker", label: "Anything reading the URL", kind: "attacker" },
  ],
  steps: [
    { from: "browser", to: "as", label: "GET /authorize?response_type=token", http: `GET /authorize?response_type=token&client_id=demo-spa&redirect_uri=${CB}&scope=${SCOPE}&state=${STATE} HTTP/1.1\n${AS}`, note: "The implicit flow (RFC 6749 section 4.2) asked for the access token directly. There was no code, no back channel and no client authentication." },
    { from: "as", to: "browser", label: "302 to /callback#access_token=…", http: `HTTP/1.1 302 Found\nLocation: http://localhost:4113/callback#access_token=${ACCESS}&token_type=Bearer&expires_in=300&state=${STATE}`, note: "Historical behaviour, not something the lab does. The token is delivered in the URL fragment of the redirect.", danger: true },
    { from: "browser", to: "attacker", label: "token in the URL", note: "The URL lands in browser history and can be read by extensions, injected scripts and shared screens. There is also no way to bind the token to the app that asked for it.", danger: true },
    { from: "browser", to: "as", label: "the same request, against the lab", http: `GET /authorize?response_type=token&client_id=demo-spa&redirect_uri=${CB}&scope=${SCOPE}&state=${STATE} HTTP/1.1\n${AS}`, note: "Run it yourself: send response_type=token to the lab." },
    { from: "as", to: "browser", label: "302 error=unsupported_response_type", http: `HTTP/1.1 302 Found\nCache-Control: no-store\nLocation: http://localhost:4113/callback?error=unsupported_response_type&state=${STATE}`, note: "OAuth 2.1 removes the implicit grant and RFC 9700 says not to use it. A browser app uses the authorization code flow with PKCE instead." },
  ],
};

const authCodePkce: Flow = {
  id: "authCodePkce",
  title: "PKCE: prove that the app redeeming the code is the app that asked for it",
  actors: [
    { id: "app", label: "Client app", kind: "browser" },
    { id: "as", label: "Authorization server", kind: "as" },
  ],
  steps: [
    { from: "app", to: "app", label: "make a code_verifier", note: `A fresh random secret per request: 32 random bytes as base64url (43 characters). This run uses the RFC 7636 example, ${VERIFIER}. It stays in the app.` },
    { from: "app", to: "app", label: "code_challenge = BASE64URL(SHA-256(verifier))", note: `SHA-256 is one-way, so the challenge reveals nothing about the verifier. For the example it is ${CHALLENGE}.` },
    { from: "app", to: "as", label: "GET /authorize + code_challenge", http: authorizeReq(`&${CH}`), note: "Only the challenge and the method go out. S256 is the only method the lab accepts." },
    { from: "as", to: "as", label: "store the challenge with the code", note: "The authorization server remembers the challenge next to the code it is about to issue. The lab stores sha256 of the code, never the code." },
    { from: "as", to: "app", label: "302 to /callback?code=…", http: redirect302(CODE), note: "The code is visible in a URL, as before. What changed is that it now needs a partner." },
    { from: "app", to: "as", label: "POST /token + code_verifier", http: tokenReq(CODE, VERIFIER), note: "Now the verifier is revealed, over the back channel." },
    { from: "as", to: "as", label: "hash the verifier, compare to the challenge", note: "BASE64URL(SHA-256(code_verifier)) must equal the stored challenge, compared in constant time. A malformed verifier fails too." },
    { from: "as", to: "app", label: "200 access token", http: tokenOk, note: "A thief who got only the code has no verifier, and cannot make one that hashes to the stored value." },
  ],
};

const codeInterception: Flow = {
  id: "codeInterception",
  title: "Code interception on a phone: the same attack without and with PKCE",
  actors: [
    { id: "app", label: "Bank app", kind: "browser" },
    { id: "mal", label: "Malicious app (same scheme)", kind: "attacker" },
    { id: "as", label: "Authorization server", kind: "as" },
  ],
  steps: [
    { from: "app", to: "as", label: "A: authorize, no PKCE", http: authorizeReq("&lab_mode=vulnerable"), note: "Scenario A. The lab's vulnerable mode lets an authorization request through with no code_challenge. On a phone the redirect_uri would be a custom scheme such as com.example.bank:/callback (RFC 8252)." },
    { from: "as", to: "mal", label: "302 delivered to the wrong app", http: redirect302(CODE), note: "Several apps can register the same custom scheme, and the OS picks one. The malicious app now holds the code and the redirect_uri.", danger: true },
    { from: "mal", to: "as", label: "POST /token: code, no verifier", http: tokenReq(CODE), note: "The attacker redeems the code before the real app does. The lab's /__attack/intercept helper sends exactly this request.", danger: true },
    { from: "as", to: "mal", label: "200 access token", http: tokenOk, note: "Nothing ties the code to the app that started the flow, so whoever presents it first wins.", danger: true },
    { from: "app", to: "as", label: "B: authorize with PKCE", http: authorizeReq(`&${CH}`), note: "Scenario B. The same flow, but the app sends a code_challenge." },
    { from: "as", to: "mal", label: "302 delivered to the wrong app", http: redirect302(CODE_ATT), note: "Interception still works. The attacker gets the code again." },
    { from: "mal", to: "as", label: "POST /token: code, no verifier", http: tokenReq(CODE_ATT), note: "The attacker has the code and the redirect_uri. The verifier never left the real app." },
    { from: "as", to: "mal", label: "400 invalid_grant", http: grant400, note: "The stored challenge needs a matching verifier. The failed attempt does not burn the code: a thief cannot lock the real app out." },
    { from: "app", to: "as", label: "POST /token + code_verifier", http: tokenReq(CODE_ATT, VERIFIER), note: "The real app redeems the same code with its verifier and succeeds (the response is a 200 like the one above)." },
  ],
};

const stateCsrf: Flow = {
  id: "stateCsrf",
  title: "state: stopping an attacker from feeding the app their own authorization response",
  actors: [
    { id: "attacker", label: "Attacker", kind: "attacker" },
    { id: "victim", label: "Victim's browser", kind: "browser" },
    { id: "as", label: "Authorization server", kind: "as" },
  ],
  steps: [
    { from: "attacker", to: "as", label: "authorize with the attacker's own account", http: authorizeReq(`&${CH}`), note: "The attacker starts a flow in their own browser and signs in as themselves." },
    { from: "as", to: "attacker", label: "302 to /callback?code=…", http: redirect302(CODE_ATT), note: "The attacker does NOT follow this redirect. They keep the URL, which holds a valid code for the attacker's account." },
    { from: "attacker", to: "victim", label: "forged link", http: `GET /callback?code=${CODE_ATT}&state=${STATE} HTTP/1.1\nHost: localhost:4113`, note: "The attacker gets the victim to open http://localhost:4113/callback with the attacker's code in the query: an email, an image, a hidden redirect.", danger: true },
    { from: "victim", to: "victim", label: "client checks state", note: "The victim's tab never started a flow, so it has no stored state, or a different one. The values do not match and the client discards the code. This is exactly what the lab's SPA shows when you open a callback by hand." },
    { from: "victim", to: "as", label: "without the check: POST /token", http: tokenReq(CODE_ATT), note: "A client that skips the check would redeem the attacker's code, and the victim's session would be signed in as the attacker. Anything the victim then uploads lands in the attacker's account.", danger: true },
  ],
};

const clientCredentials: Flow = {
  id: "clientCredentials",
  title: "Client credentials: a backend job gets a token with no user involved",
  actors: [
    { id: "job", label: "Backend job", kind: "server" },
    { id: "as", label: "Authorization server", kind: "as" },
    { id: "api", label: "API", kind: "api" },
  ],
  steps: [
    { from: "job", to: "as", label: "POST /token: grant_type=client_credentials", http: `POST /token HTTP/1.1\n${AS}\n${FORM}\nAuthorization: Basic ZGVtby1iYWNrZW5kOmxhYi1zZWNyZXQ=\n\ngrant_type=client_credentials&scope=photos.read`, note: "The job authenticates with its own secret using HTTP Basic (client_id:client_secret, base64). There is no browser, no redirect and no consent." },
    { from: "as", to: "as", label: "check the secret, check the scope", note: "The secret is compared in constant time. The requested scope must be a subset of what this client is allowed; asking for more gives invalid_scope." },
    { from: "as", to: "job", label: "200 access token", http: `HTTP/1.1 200 OK\nContent-Type: application/json\nCache-Control: no-store\nPragma: no-cache\n\n{"access_token":"${ACCESS}","token_type":"Bearer","expires_in":300,"scope":"photos.read"}`, note: "The token's sub is the client itself (demo-backend). There is no user and no refresh token: when it expires the job just asks again." },
    { from: "job", to: "api", label: "GET /api/photos", http: photosReq, note: "The API checks signature, iss, aud, exp and the photos.read scope." },
    { from: "api", to: "job", label: "200 photos", http: photosOk },
    { from: "job", to: "as", label: "wrong secret", http: `POST /token HTTP/1.1\n${AS}\n${FORM}\nAuthorization: Basic ZGVtby1iYWNrZW5kOm5vcGU=\n\ngrant_type=client_credentials`, note: "For contrast: a bad secret." },
    { from: "as", to: "job", label: "401 invalid_client", http: `HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Basic realm="lab03"\nContent-Type: application/json\nCache-Control: no-store\nPragma: no-cache\n\n{"error":"invalid_client"}`, note: "Client authentication failed (RFC 6749 section 5.2)." },
  ],
};

// A preview, not a spec: it only maps the standard authorization code flow onto the parts named in the project plan.
const ssoPreview: Flow = {
  id: "ssoPreview",
  title: "Phase 2 preview: how the authorization code flow could map onto your SSO parts",
  actors: [
    { id: "user", label: "User", kind: "user" },
    { id: "pa", label: "Platform A (Next.js)", kind: "server" },
    { id: "ssof", label: "sso-frontend (Next.js)", kind: "browser" },
    { id: "ssob", label: "sso-backend (Go)", kind: "as" },
    { id: "core", label: "core-api (Go)", kind: "api" },
    { id: "pb", label: "Platforms B and C (Next.js)", kind: "server" },
  ],
  steps: [
    { from: "user", to: "pa", label: "open Platform A", note: "Illustrative only. Platforms A, B and C are clients of one sign-in service." },
    { from: "pa", to: "ssof", label: "redirect to sign-in (authorize request)", note: "Platform A has no login form. It sends the browser to the sign-in service with client_id, redirect_uri, scope, state and a PKCE challenge." },
    { from: "ssof", to: "ssob", label: "sign in", note: "The user signs in on the sign-in screen. In this preview the screen hands off to the service that checks credentials and issues codes." },
    { from: "ssob", to: "pa", label: "302 back with ?code=…&state=…", note: "A code returns to Platform A's registered redirect_uri." },
    { from: "pa", to: "ssob", label: "POST /token + code_verifier", note: "Platform A redeems the code on its back channel, as in lesson 2." },
    { from: "ssob", to: "pa", label: "access token", note: "A short-lived token that says who the user is and what the platform may do." },
    { from: "pa", to: "core", label: "API call + Bearer token", note: "A shared API can verify the token like the lab's resource server does, using the issuer's public keys." },
    { from: "user", to: "pb", label: "open Platform B or C later", note: "A platform repeats the same redirect. If the user is still signed in at the sign-in service, a code comes straight back with no password prompt. That is single sign-on." },
  ],
};

export const m3Flows = { oauthRoles, authCode, implicitDeprecated, authCodePkce, codeInterception, stateCsrf, clientCredentials, ssoPreview } satisfies Record<string, Flow>;
