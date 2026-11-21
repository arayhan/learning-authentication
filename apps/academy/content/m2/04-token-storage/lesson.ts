import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l4",
  module: "m2",
  slug: "token-storage",
  title: "Where to Keep Tokens",
  minutes: 25,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "options", title: "The options" },
    { id: "check", title: "Check" },
    { id: "simulate", title: "Simulator" },
    { id: "code", title: "Code" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "A script injected through an XSS bug runs on your page. Which stored token can it read directly?",
          choices: [
            "A refresh token in an HttpOnly cookie",
            "A token held in a variable inside the app's own module",
            "None: browsers stop injected scripts from reading storage",
            "An access token saved in localStorage",
          ],
          answer: 3,
          why: "localStorage and sessionStorage are readable by any script running on the origin, including an injected one. An HttpOnly cookie is hidden from JavaScript, and a variable inside a module is not reachable from outside it.",
        },
        {
          prompt: "Which setup puts the access token on every request automatically, which makes CSRF a concern for the API?",
          choices: [
            "Keeping it in memory and sending an Authorization header",
            "Keeping it in localStorage and sending an Authorization header",
            "Keeping it in a cookie that the browser attaches to API calls",
            "Keeping it in a JavaScript closure",
          ],
          answer: 2,
          why: "A cookie is an ambient credential: the browser attaches it to any request to that site, whatever page triggered it, which is the CSRF weakness from Module 1. An Authorization header has to be set by your own code, so a forged cross-site request does not carry it.",
        },
        {
          prompt: "The access token is in memory and the refresh token is in an HttpOnly cookie. What can XSS still do?",
          choices: [
            "Nothing: the pattern makes XSS harmless",
            "Read the refresh token with document.cookie",
            "Steal the token from the next page load",
            "Act as the user while the page is open, by calling the API and /refresh from inside it, though it cannot carry the refresh token away",
          ],
          answer: 3,
          why: "The script runs with the page's privileges, so it can make requests and the browser attaches the cookie for it. HttpOnly stops it from taking the credential, not from using it. The pattern limits how long and how far the damage goes. It does not remove XSS from the threat list.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [{ id: "xss-storage", title: "XSS token theft from browser storage", kind: "simulated" }],
};

export default lesson;
