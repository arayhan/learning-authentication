import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l7",
  module: "m1",
  slug: "boss",
  title: "Module 1 Boss",
  minutes: 15,
  steps: [{ id: "intro", title: "Intro" }],
  quizzes: [
    {
      id: "boss",
      boss: { seconds: 600, passRatio: 0.8 },
      questions: [
        {
          prompt: "A request to GET /me arrives with no session cookie at all. Which response is correct?",
          choices: ["403 Forbidden", "401 Unauthorized", "404 Not Found", "200 with an empty body"],
          answer: 1,
          why: "There is no proof of who is calling, so the server cannot say they are known. 401 means unauthenticated. 403 is for a known caller who is not allowed.",
        },
        {
          prompt: "Which is the right way to store a user's password?",
          choices: [
            "Encrypt it with AES and keep the key in the app's config",
            "Hash it once with SHA-256",
            "Hash it with argon2id and a unique random salt, saved as a PHC string",
            "Store it in plaintext but lock down database access",
          ],
          answer: 2,
          why: "A password needs a one-way, deliberately slow, salted hash. Encryption is reversible, SHA-256 is fast enough to brute-force, and plaintext turns any leak into a disaster.",
        },
        {
          prompt: "Why is the salt stored right inside the PHC string, next to the hash?",
          choices: [
            "The verifier needs it to recompute the hash, and a salt is not a secret",
            "It is a secret key, and storing it there is a deliberate trade-off",
            "It makes the string shorter",
            "It lets users look up their own hash",
          ],
          answer: 0,
          why: "A salt is public by design. Its job is uniqueness, which defeats precomputed tables. Verification needs the same salt, so it travels with the hash.",
        },
        {
          prompt: "Which cookie attribute stops page JavaScript from reading the session id?",
          choices: ["Secure", "SameSite=Lax", "Path=/", "HttpOnly"],
          answer: 3,
          why: "HttpOnly removes the cookie from document.cookie. Secure restricts transport to HTTPS, SameSite controls cross-site sending, and Path only scopes the URLs.",
        },
        {
          prompt: "A developer sets the session cookie to sid=<the user's numeric id>. What is the main problem?",
          choices: [
            "The cookie is too short to be sent",
            "Anyone can set sid=42 and become user 42, because the value is guessable",
            "Numeric cookies cannot be HttpOnly",
            "The server cannot look up a number quickly",
          ],
          answer: 1,
          why: "A session id is a bearer secret and must be unguessable. A guessable id lets an attacker impersonate any user simply by changing the value. Use 32 random bytes with no meaning.",
        },
        {
          prompt: "A site keeps whatever session id the browser sends, even across login. Which attack does this enable?",
          choices: ["CSRF", "Credential stuffing", "Session fixation", "Account enumeration"],
          answer: 2,
          why: "If the id survives login, an attacker who planted it beforehand now holds an authenticated session. Issuing a fresh id at login prevents it.",
        },
        {
          prompt: "A user changes their password because they suspect someone knows it. What should the server do with sessions?",
          choices: [
            "Nothing: sessions are independent of passwords",
            "Log the user out of the current device only",
            "Extend all sessions so the user is not interrupted",
            "End every other session and issue a new session id to the current device",
          ],
          answer: 3,
          why: "A session that was opened with the old password may belong to the person the user is worried about. Destroying the others and rotating the current id closes that gap.",
        },
        {
          prompt: "Which of these does NOT help against a forged cross-site POST?",
          choices: [
            "Marking the session cookie HttpOnly",
            "SameSite=Lax on the session cookie",
            "Requiring a per-session CSRF token in a header",
            "Checking the Origin header of unsafe requests",
          ],
          answer: 0,
          why: "HttpOnly hides the cookie from scripts, but the browser still attaches it to a forged request. The other three each block the forgery at a different point.",
        },
        {
          prompt: "Login for an unknown email returns instantly, while a wrong password takes about 50 ms. What is the problem and the fix?",
          choices: [
            "The unknown path is too fast: skip hashing for known emails too",
            "Timing reveals which emails exist: verify against a dummy hash for unknown emails",
            "The wrong-password path is too slow: lower the argon2id cost until they match",
            "There is no problem: the responses have the same body",
          ],
          answer: 1,
          why: "Equal bodies do not help if the timing differs. An attacker can measure the gap across many requests. Hashing a dummy value makes both paths cost about the same.",
        },
        {
          prompt: "An attacker tries the password 'Summer2024!' once against each of 50,000 accounts. No account sees more than one failure. Which defense is aimed squarely at this?",
          choices: [
            "A limit of 5 failures per account",
            "Longer session lifetimes",
            "Limits per IP and monitoring of the overall failure rate, plus rejecting common passwords",
            "CSRF tokens on /login",
          ],
          answer: 2,
          why: "This is password spraying. Per-account limits never trigger, so you need limits across accounts (per IP or device), alerts on the overall failure rate, and screening against breached and common passwords.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;
