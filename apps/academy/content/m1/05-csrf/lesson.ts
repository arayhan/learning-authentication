import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l5",
  module: "m1",
  slug: "csrf",
  title: "CSRF",
  minutes: 25,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "attack", title: "The attack" },
    { id: "defenses", title: "Defenses" },
    { id: "simulate", title: "Simulator" },
    { id: "check", title: "Check" },
    { id: "lab", title: "Lab" },
    { id: "code", title: "Code" },
    { id: "breakit", title: "Break it" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Why does the browser send the bank's session cookie on a forged request that evil.example triggered?",
          choices: [
            "Because evil.example guessed the cookie value",
            "Because the bank's server asked the browser to send it",
            "Because browsers attach a site's cookies to every request to that site, whichever page started it",
            "Because HttpOnly cookies are shared between sites",
          ],
          answer: 2,
          why: "Cookies are ambient credentials: the browser adds them automatically based on where the request goes, not where it came from. That is the whole weakness CSRF abuses.",
        },
        {
          prompt: "Why can evil.example not simply copy the bank's CSRF token into its forged form?",
          choices: [
            "The token is encrypted with the attacker's public key",
            "The same-origin policy stops evil.example from reading the bank's pages and responses, so it never sees the token",
            "The token is only valid for one second",
            "The browser blocks all forms that point at other sites",
          ],
          answer: 1,
          why: "A cross-site page can make the browser send a request but cannot read the response. The token lives in the bank's own page or response, so the attacker has nothing to copy.",
        },
        {
          prompt: "Your API sends no CORS headers at all. Does that protect it from CSRF?",
          choices: [
            "Yes, browsers refuse to send cross-origin requests without CORS headers",
            "Yes, but only for POST requests",
            "Only if the request also uses HTTPS",
            "No: CORS controls who may read responses. A simple cross-site request is still sent, with cookies",
          ],
          answer: 3,
          why: "CORS is about reading cross-origin responses. A form POST or a no-cors fetch still reaches the server and still carries cookies. That is why CSRF needs its own defenses.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "transfer-403",
      label: "Send a transfer without a CSRF token and get a 403",
      lab: "01",
      hint: "Log in, then click Transfer, no token. The request has a valid cookie and still fails.",
      match: (e) => e.req.method === "POST" && e.req.path === "/transfer" && e.res.status === 403 && !e.req.headers["x-csrf-token"],
    },
    {
      id: "transfer-200",
      label: "Send a transfer with the CSRF token and get a 200",
      lab: "01",
      hint: "Click Transfer, with token. The console takes the token from your last login response and sends it as X-CSRF-Token.",
      match: (e) => e.req.method === "POST" && e.req.path === "/transfer" && e.res.status === 200 && !!e.req.headers["x-csrf-token"],
    },
  ],
  attacks: [{ id: "csrf", title: "Cross-site request forgery", kind: "simulated" }],
};

export default lesson;
