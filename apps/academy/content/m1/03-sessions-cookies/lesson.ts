import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l3",
  module: "m1",
  slug: "sessions-cookies",
  title: "Sessions & Cookies",
  minutes: 20,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "cookie", title: "Anatomy of a cookie" },
    { id: "server", title: "What the server keeps" },
    { id: "check", title: "Check" },
    { id: "lab", title: "Lab" },
    { id: "code", title: "Code" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Why does the server store sha256(token) instead of the session token itself?",
          choices: [
            "It makes lookups faster",
            "It keeps the cookie small",
            "A leaked database dump then contains no usable session cookies",
            "It lets the client verify the cookie without asking the server",
          ],
          answer: 2,
          why: "Whoever holds the token is the user. If the database stores only the hash, a dump gives an attacker nothing they can put into a cookie. Hashing a 256-bit random token needs no salt or slow hash, because it cannot be guessed.",
        },
        {
          prompt: "What does the HttpOnly attribute do?",
          choices: [
            "Hides the cookie from JavaScript, so an XSS bug cannot read and exfiltrate it",
            "Stops the browser sending the cookie on cross-site requests",
            "Restricts the cookie to HTTPS connections",
            "Encrypts the cookie value in the browser",
          ],
          answer: 0,
          why: "HttpOnly removes the cookie from document.cookie. Stopping cross-site requests is SameSite's job, and HTTPS-only is Secure. Note that an XSS bug can still make requests that carry the cookie; HttpOnly only stops it being stolen.",
        },
        {
          prompt: "Which is the best session identifier?",
          choices: [
            "The user id plus a timestamp",
            "32 bytes from a cryptographically secure random generator, with no meaning",
            "The md5 of the user's email address",
            "An incrementing counter",
          ],
          answer: 1,
          why: "A session id is a bearer secret, so it must be unguessable: at least 64 bits of entropy per OWASP, 256 here. Anything derived from user data or a counter can be guessed or forged, and a good id carries no information at all.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "set-cookie-httponly",
      label: "Log in and spot a Set-Cookie with HttpOnly and SameSite=Lax",
      lab: "01",
      hint: "Click Log in as alice, then open the POST /login row in the Inspector and look at the Cookies tab.",
      match: (e) => {
        const raw = e.res.headers["set-cookie"];
        return [raw ?? []].flat().some((c) => /^sid=[^;]+/.test(c) && /;\s*HttpOnly/i.test(c) && /;\s*SameSite=Lax/i.test(c));
      },
    },
    {
      id: "me-200",
      label: "Prove the cookie works: GET /me returns 200",
      lab: "01",
      hint: "Click Whoami after logging in. The browser sends the cookie on its own.",
      match: (e) => e.req.method === "GET" && e.req.path === "/me" && e.res.status === 200,
    },
  ],
  attacks: [],
};

export default lesson;
