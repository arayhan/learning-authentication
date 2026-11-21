import type { Flow } from "@/components/flow/types";

// Raw messages mirror the Lab 01 HTTP contract (labs/01-sessions): JSON bodies, `sid` cookie, 401/403/429 bodies.
const SID = "Xk3q9ZmB1vW8eYrT5uLpA7sD0fGhJcN4iOaE6bQwVyU";
const SID2 = "q8LzT0vN2cYp5HsK9dWm3RbX7eJgA1uFoZiE4tQhB6c";
const CSRF = "n7PqR2sV5xYb8CdF1gHj4KmL6tWz9AeUoI3yT0uQ_vE";
const HOST = "Host: localhost:4101";
const JSON_HDR = "Content-Type: application/json";
const cookie = (sid: string) => `Set-Cookie: sid=${sid}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax`;
const login = (email: string, password: string, extra = "") =>
  `POST /login HTTP/1.1\n${HOST}\n${JSON_HDR}${extra}\n\n{"email":"${email}","password":"${password}"}`;
const ok = (sid: string, csrf = CSRF) => `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n${cookie(sid)}\n\n{"csrfToken":"${csrf}"}`;
const generic401 = `HTTP/1.1 401 Unauthorized\n${JSON_HDR}\nCache-Control: no-store\n\n{"error":"invalid credentials"}`;

const whoIsWho: Flow = {
  id: "whoIsWho",
  title: "Authentication once, authorization every time",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /login", http: login("sam@example.com", "correct horse battery"), note: "Authentication starts: the caller claims to be Sam and offers proof." },
    { from: "server", to: "db", label: "load Sam's hash", note: "The server finds the account and checks the proof against the stored hash." },
    { from: "server", to: "browser", label: "200 + Set-Cookie", http: ok(SID), note: "Proof accepted. The server now knows who is calling, and hands out a session cookie to say so next time." },
    {
      from: "browser",
      to: "server",
      label: "GET /invoices/42",
      http: `GET /invoices/42 HTTP/1.1\n${HOST}\nCookie: sid=${SID}`,
      note: "A later request. The cookie answers 'who is this?'. It does not answer 'may Sam read this invoice?'.",
    },
    { from: "server", to: "db", label: "may Sam read 42?", note: "Authorization: the server checks the owner of invoice 42 against Sam. It repeats this check on every request." },
    {
      from: "server",
      to: "browser",
      label: "403 forbidden",
      http: `HTTP/1.1 403 Forbidden\n${JSON_HDR}\n\n{"error":"forbidden"}`,
      note: "Known user, not allowed. A 401 would have meant 'I do not know who you are'.",
    },
  ],
};

const registerLogin: Flow = {
  id: "registerLogin",
  title: "Register, then log in: what happens to the password",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /register", http: `POST /register HTTP/1.1\n${HOST}\n${JSON_HDR}\n\n{"email":"alice@example.com","password":"correct horse battery"}`, note: "The plaintext password travels once, over HTTPS, and is never stored." },
    { from: "server", to: "server", label: "argon2id(pw, salt)", note: "A fresh random 16-byte salt, then argon2id with m=19456 KiB, t=2, p=1. Slow and memory-hungry on purpose." },
    { from: "server", to: "db", label: "INSERT user", note: "Stored: the email and one PHC string, $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>. The password itself is gone." },
    { from: "server", to: "browser", label: "201 Created", http: `HTTP/1.1 201 Created\n${JSON_HDR}\nCache-Control: no-store\n\n{"id":"6f1c2b9e-3a4d-4e8f-9b1a-7c5d2e0f8a34","email":"alice@example.com"}`, note: "The response never echoes the hash." },
    { from: "browser", to: "server", label: "POST /login", http: login("alice@example.com", "correct horse battery"), note: "Later: the same password arrives again." },
    { from: "server", to: "db", label: "SELECT hash", note: "The server reads the PHC string, which carries its own salt and cost parameters." },
    { from: "server", to: "server", label: "re-hash and compare", note: "It hashes the attempt with the stored salt and compares in constant time. Equal hashes mean the password matched." },
    { from: "server", to: "db", label: "INSERT session", note: "A new session row, keyed by the sha256 of a fresh random token." },
    { from: "server", to: "browser", label: "200 + Set-Cookie", http: ok(SID), note: "Login done. The hash never leaves the database." },
  ],
};

const sessionCookie: Flow = {
  id: "sessionCookie",
  title: "A session cookie, from Set-Cookie to the next request",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /login", http: login("alice@example.com", "correct horse battery"), note: "Credentials in, as before." },
    { from: "server", to: "db", label: "INSERT sha256(sid)", note: "The server stores only the sha256 of the token. A leaked database dump contains no usable cookies." },
    { from: "server", to: "browser", label: "200 + Set-Cookie", http: ok(SID), note: "The cookie is the ticket: 32 random bytes, HttpOnly, SameSite=Lax, one hour." },
    { from: "browser", to: "browser", label: "store cookie", note: "The browser files the cookie under this site and sends it automatically from now on." },
    { from: "browser", to: "server", label: "GET /me", http: `GET /me HTTP/1.1\n${HOST}\nCookie: sid=${SID}`, note: "No password this time. The cookie rides along on its own." },
    { from: "server", to: "db", label: "SELECT by sha256(sid)", note: "Hash the cookie, look the hash up, check the expiry." },
    { from: "server", to: "browser", label: "200 {email}", http: `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n\n{"email":"alice@example.com"}`, note: "The server recognises the ticket and answers as Alice." },
    { from: "browser", to: "browser", label: "document.cookie", note: "A script on the page reads document.cookie and does not see sid. HttpOnly keeps the ticket out of reach of injected JavaScript." },
  ],
};

const sessionRotation: Flow = {
  id: "sessionRotation",
  title: "Rotating the session id on login",
  actors: [
    { id: "browser", label: "Browser", kind: "browser" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "browser", to: "server", label: "POST /login (old sid)", http: login("alice@example.com", "correct horse battery", `\nCookie: sid=${SID}`), note: "The browser already holds a session id from before the login." },
    { from: "server", to: "server", label: "verify password", note: "Rate limit and password check pass first." },
    { from: "server", to: "db", label: "DELETE old session", note: "The id the client presented is deleted. Whoever else knows it loses access." },
    { from: "server", to: "db", label: "INSERT new session", note: "A new random token, stored as its sha256, with a new CSRF token." },
    { from: "server", to: "browser", label: "200 + new Set-Cookie", http: ok(SID2), note: "The browser replaces its cookie with the new id." },
    { from: "browser", to: "server", label: "GET /me (old sid)", http: `GET /me HTTP/1.1\n${HOST}\nCookie: sid=${SID}`, note: "Anyone replaying the old id now..." },
    { from: "server", to: "browser", label: "401 unauthorized", http: `HTTP/1.1 401 Unauthorized\n${JSON_HDR}\nCache-Control: no-store\n\n{"error":"unauthorized"}`, note: "...gets nothing. The privilege change (anonymous to signed in) came with a new id." },
  ],
};

const fixation: Flow = {
  id: "fixation",
  title: "Session fixation against a server that keeps the incoming id",
  actors: [
    { id: "attacker", label: "Attacker", kind: "attacker" },
    { id: "browser", label: "Victim browser", kind: "browser" },
    { id: "server", label: "Server (vulnerable)", kind: "server" },
  ],
  steps: [
    {
      from: "attacker",
      to: "server",
      label: "plant sid=ATTACKER",
      http: `POST /__attack/plant-sid HTTP/1.1\n${HOST}\n${JSON_HDR}\nX-Lab-Mode: vulnerable\n\n{"sid":"attacker-chosen-sid"}`,
      danger: true,
      note: "The attacker picks an id. Real attacks get it into the victim's browser through a sibling subdomain, an injected script or a URL. The lab does it with a helper.",
    },
    { from: "server", to: "browser", label: "Set-Cookie: sid=ATTACKER", http: `HTTP/1.1 200 OK\n${JSON_HDR}\n${cookie("attacker-chosen-sid")}\n\n{"ok":true}`, danger: true, note: "The victim's browser now carries a session id the attacker knows." },
    { from: "browser", to: "server", label: "POST /login", http: login("victim@example.com", "correct horse battery", "\nX-Lab-Mode: vulnerable\nCookie: sid=attacker-chosen-sid"), note: "The victim logs in normally. They notice nothing." },
    { from: "server", to: "server", label: "keeps incoming sid", danger: true, note: "VULNERABLE: instead of issuing a new id, the server promotes the one it was handed to an authenticated session." },
    { from: "server", to: "browser", label: "200 OK", http: ok("attacker-chosen-sid"), note: "The victim is signed in, under the attacker's id." },
    {
      from: "attacker",
      to: "server",
      label: "GET /me (sid=ATTACKER)",
      http: `GET /me HTTP/1.1\n${HOST}\nCookie: sid=attacker-chosen-sid`,
      danger: true,
      note: "The attacker never saw the victim's password or cookie. They only needed the id they chose.",
    },
    { from: "server", to: "attacker", label: "200 {victim}", http: `HTTP/1.1 200 OK\n${JSON_HDR}\nCache-Control: no-store\n\n{"email":"victim@example.com"}`, danger: true, note: "Account taken over. In secure mode this last response is a 401, because login rotated the id." },
  ],
};

const csrfAttack: Flow = {
  id: "csrfAttack",
  title: "CSRF: a forged request that carries the victim's cookie",
  actors: [
    { id: "browser", label: "Victim browser", kind: "browser" },
    { id: "bank", label: "bank.example", kind: "server" },
    { id: "evil", label: "evil.example", kind: "attacker" },
  ],
  steps: [
    { from: "browser", to: "bank", label: "POST /login", http: login("sam@example.com", "correct horse battery"), note: "Sam signs in to the bank. The browser keeps the session cookie." },
    { from: "bank", to: "browser", label: "200 + Set-Cookie", http: ok(SID), note: "The bank also hands out a per-session CSRF token in the response body." },
    { from: "browser", to: "evil", label: "GET evil.example", http: "GET /free-cruise HTTP/1.1\nHost: evil.example", note: "In another tab, Sam opens a page the attacker controls." },
    { from: "evil", to: "browser", label: "auto-submitting form", danger: true, note: "The page contains a hidden form aimed at the bank and submits it on load." },
    {
      from: "browser",
      to: "bank",
      label: "POST /transfer (forged)",
      http: `POST /transfer HTTP/1.1\nHost: bank.example\nOrigin: https://evil.example\nContent-Type: application/x-www-form-urlencoded\nCookie: sid=${SID}\n\nto=mallory&amount=500`,
      danger: true,
      note: "The browser attaches the bank's cookie to any request going to the bank, no matter which page triggered it. The Origin header is the only clue.",
    },
    { from: "bank", to: "browser", label: "200: money moved", http: `HTTP/1.1 200 OK\n${JSON_HDR}\n\n{"ok":true}`, danger: true, note: "No token, no Origin check, no SameSite: the bank cannot tell Sam's click from the attacker's form." },
    {
      from: "browser",
      to: "bank",
      label: "POST /transfer (no token)",
      http: `POST /transfer HTTP/1.1\n${HOST}\n${JSON_HDR}\nCookie: sid=${SID}\n\n{"to":"mallory","amount":500}`,
      note: "With the lab's defenses on, the same forged shape arrives without the secret header.",
    },
    { from: "bank", to: "browser", label: "403 csrf", http: `HTTP/1.1 403 Forbidden\n${JSON_HDR}\n\n{"error":"csrf"}`, note: "The attacker can send the cookie but cannot read the token, so the request dies here." },
  ],
};

const bruteForce: Flow = {
  id: "bruteForce",
  title: "Guessing passwords against /login",
  actors: [
    { id: "attacker", label: "Attacker", kind: "attacker" },
    { id: "server", label: "Server", kind: "server" },
    { id: "db", label: "Database", kind: "db" },
  ],
  steps: [
    { from: "attacker", to: "server", label: "POST /login (guess 1)", http: login("alice@example.com", "password1"), danger: true, note: "One guess against one account." },
    { from: "server", to: "db", label: "count recent failures", note: "In one transaction, locked per email: how many failures in the last 15 minutes?" },
    { from: "server", to: "attacker", label: "401 invalid credentials", http: generic401, note: "Wrong password. The message does not say whether the email exists." },
    { from: "attacker", to: "server", label: "guesses 2 to 5", danger: true, note: "Four more wrong guesses, four more identical 401s. Each failure is recorded." },
    { from: "attacker", to: "server", label: "POST /login (guess 6)", http: login("alice@example.com", "letmein"), danger: true, note: "The sixth attempt inside the window." },
    { from: "server", to: "db", label: "5 failures: blocked", note: "The count is already 5, so the password is not even checked. Even the correct one would be refused now." },
    { from: "server", to: "attacker", label: "429 + Retry-After", http: `HTTP/1.1 429 Too Many Requests\n${JSON_HDR}\nRetry-After: 900\nCache-Control: no-store\n\n{"error":"too many attempts"}`, note: "Guessing stops being cheap. The same limit applies to unknown emails, so the limiter does not leak which accounts exist." },
    { from: "attacker", to: "server", label: "POST /login (unknown email)", http: login("nobody@example.com", "password1"), danger: true, note: "Does this account exist? The attacker tries to find out." },
    { from: "server", to: "server", label: "dummy argon2 verify", note: "No account, so the server hashes the attempt against a dummy hash anyway. Unknown email and wrong password cost the same time." },
    { from: "server", to: "attacker", label: "401 invalid credentials", http: generic401, note: "Byte-for-byte the same response as a wrong password. Nothing to enumerate." },
  ],
};

export const m1Flows = { whoIsWho, registerLogin, sessionCookie, sessionRotation, fixation, csrfAttack, bruteForce } satisfies Record<string, Flow>;
