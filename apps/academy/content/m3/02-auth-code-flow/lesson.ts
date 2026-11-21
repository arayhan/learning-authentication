import type { LessonMeta } from "@/lib/course/types";

/** Location header (string or list), as the trace records it with lowercase names. */
const location = (h: Record<string, string | string[]>) => [h.location ?? []].flat().join(" ");

const lesson: LessonMeta = {
  id: "m3-l2",
  module: "m3",
  slug: "auth-code-flow",
  title: "Authorization Code Flow",
  minutes: 30,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
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
          prompt: "Why does the authorization server send the browser back with a code instead of the access token itself?",
          choices: [
            "A code is shorter than a token",
            "The redirect travels through the browser URL, which leaks into history, logs and other apps. The code is a short, single-use ticket that is exchanged over a direct back channel",
            "HTTP does not allow tokens in a redirect",
            "The user would otherwise have to sign in twice",
          ],
          answer: 1,
          why: "Everything in a redirect URL is exposed to the browser and whatever sits around it. A code that is valid for a minute, works once and is bound to the client and redirect_uri limits what a leak is worth, and the real token is delivered where only the client can read it: the response to its own back-channel request.",
        },
        {
          prompt: "A request reaches /authorize with a redirect_uri that is not registered for the client. What should the server do?",
          choices: [
            "Redirect to that URI with error=invalid_request",
            "Redirect to the client's first registered URI",
            "Show an error page to the user and do not redirect anywhere",
            "Accept it, because the client_id is valid",
          ],
          answer: 2,
          why: "RFC 6749 section 4.1.2.1: if the client_id or redirect_uri is missing, invalid or mismatched, the server must not redirect. Redirecting to an unverified URI would turn the authorization server into an open redirector. Only after those two checks do errors travel back as ?error=... redirects.",
        },
        {
          prompt: "An authorization code is presented to /token a second time. What does RFC 6749 expect from the server?",
          choices: [
            "Issue another token, because codes can be reused for 10 minutes",
            "Silently ignore the request",
            "Extend the code's lifetime so the client can retry",
            "Reject it and, where possible, revoke the tokens already issued from that code",
          ],
          answer: 3,
          why: "A code must be single-use. A second presentation means two parties have seen it, so the server cannot tell the thief from the client and should cut off what the first redemption produced. The lab does this in one transaction and answers invalid_grant.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "authorize-302-code",
      label: "Approve access and get redirected with a code (POST /consent returns 302 with ?code=)",
      lab: "03",
      hint: "Open the client SPA, click Sign in with Demo AS, sign in as alice@example.com and click Approve. The POST /consent row in the Inspector has the code in its Location header.",
      match: (e) => e.role === "as" && e.req.method === "POST" && e.req.path === "/consent" && e.res.status === 302 && /[?&]code=[^&\s]+/.test(location(e.res.headers)),
    },
    {
      id: "token-200",
      label: "Exchange the code for an access token (POST /token returns 200)",
      lab: "03",
      hint: "The SPA does this by itself when it returns to /callback. Look for POST /token in the Inspector: the request has grant_type=authorization_code, the response an access_token.",
      match: (e) => e.role === "as" && e.req.method === "POST" && e.req.path === "/token" && e.res.status === 200 && (e.req.body ?? "").includes("grant_type=authorization_code") && (e.res.body ?? "").includes("access_token"),
    },
    {
      id: "api-200-bearer",
      label: "Call the API with the token (GET /api/photos returns 200)",
      lab: "03",
      hint: "The SPA's last step. The request carries Authorization: Bearer <access token> and the API answers with three photos.",
      match: (e) => e.role === "api" && e.req.method === "GET" && e.req.path === "/api/photos" && e.res.status === 200 && /^bearer\s+\S+/i.test(e.req.headers.authorization ?? ""),
    },
  ],
  attacks: [],
};

export default lesson;
