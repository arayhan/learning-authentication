import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l6",
  module: "m2",
  slug: "revocation",
  title: "Logout & Revocation",
  minutes: 25,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "strategies", title: "Strategies" },
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
          prompt: "A user logs out and the server revokes their refresh token family. Their access token has three minutes left. What happens to API calls that carry it?",
          choices: [
            "They fail at once, because logging out invalidates all tokens",
            "They fail after the next refresh attempt",
            "They keep working until exp, because the API verifies the token offline and never asks the server",
            "They keep working for 14 days, the life of the refresh token",
          ],
          answer: 2,
          why: "Verifying a JWT needs only the key and the claims, so nothing the server did at logout reaches the API. Revoking the refresh token only stops new access tokens from being issued. The old one lives until exp, which is why the lifetime is short.",
        },
        {
          prompt: "What does it cost to make access tokens revocable immediately, for example with a deny list of token ids?",
          choices: [
            "Nothing: the check is free",
            "Much longer tokens",
            "A different signing algorithm",
            "State: every API call now needs a lookup, which brings back the shared store that self-contained tokens were meant to avoid",
          ],
          answer: 3,
          why: "A deny list or introspection call is a server-side check on each request. That is a session lookup in disguise. It is often worth it for sensitive APIs, but it is a trade-off, and the cheaper levers are a short lifetime and revoking the refresh token.",
        },
        {
          prompt: "Why do many systems pair a 5-minute access token with a revocable refresh token?",
          choices: [
            "Because five minutes is the maximum the JWT standard allows",
            "Revoking the refresh token stops new access tokens, so the most a stolen or logged-out session can do is bounded by the access token's remaining life",
            "Because refresh tokens make access tokens invisible to attackers",
            "Because short tokens do not need signatures",
          ],
          answer: 1,
          why: "The two levers combine. The refresh token is the revocable part, and the short life of the access token is the cap on how long a revocation takes to be fully effective. Together they bound the exposure without a lookup per API call.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "logout-revokes",
      label: "Log out: POST /refresh/logout returns 204",
      lab: "02",
      hint: "Click Log in, then Log out, then Refresh to see the 401, then Profile to see the old access token still work.",
      match: (e) => e.req.method === "POST" && e.req.path === "/refresh/logout" && e.res.status === 204,
    },
  ],
  attacks: [],
};

export default lesson;
