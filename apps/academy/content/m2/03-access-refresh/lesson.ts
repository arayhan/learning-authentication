import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l3",
  module: "m2",
  slug: "access-refresh",
  title: "Access & Refresh Tokens",
  minutes: 30,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "rotation", title: "Rotation" },
    { id: "check", title: "Check" },
    { id: "lab", title: "Lab" },
    { id: "reuse", title: "Reuse detection" },
    { id: "code", title: "Code" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Why does the lab give the access token a 5-minute life but the refresh token 14 days?",
          choices: [
            "The access token is sent on every request and verified offline, so a stolen one should stop working fast. The refresh token is used rarely and the server can revoke it",
            "Short tokens are faster to verify",
            "Browsers delete cookies after 5 minutes unless they are refresh tokens",
            "The two lifetimes are arbitrary and do not affect security",
          ],
          answer: 0,
          why: "A self-contained access token cannot be recalled, so its lifetime is the exposure window. The refresh token travels rarely, lives in a server-checked table, and can be revoked, so it can afford a long life.",
        },
        {
          prompt: "The lab's refresh token is a random string stored as sha256 in the database, not a JWT. Why?",
          choices: [
            "Random strings are harder to guess than JWTs",
            "JWTs cannot be put in cookies",
            "A JWT would be too large for the Set-Cookie header",
            "The server must be able to look it up and revoke it, and a hashed store means a database leak gives no usable tokens",
          ],
          answer: 3,
          why: "The refresh token's whole job is to be a revocable, stateful credential. An opaque value that the server looks up gives it that. Hashing it means a stolen database dump cannot be replayed, the same reasoning as session ids in Module 1.",
        },
        {
          prompt: "A refresh token that was already used (and replaced) is presented again. What should the server do?",
          choices: [
            "Issue a new access token anyway, because the token is genuine",
            "Return 401 for that request only and change nothing else",
            "Return 401 and revoke the whole token family, because an old token coming back means it was copied",
            "Ignore it and wait for the real client to refresh",
          ],
          answer: 2,
          why: "With rotation, each token is used exactly once. A second use means two parties hold it, so the server cannot tell the thief from the victim. Revoking the family forces a fresh login and cuts the thief off. This is reuse detection, recommended by the OAuth 2.0 Security BCP.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "login-access-token",
      label: "Log in and get an access token (POST /login returns 200 with an access_token)",
      lab: "02",
      hint: "Click Log in. The seeded user is alice@example.com. The response body has access_token, token_type Bearer and expires_in 300.",
      match: (e) => e.req.method === "POST" && e.req.path === "/login" && e.res.status === 200 && (e.res.body ?? "").includes("access_token"),
    },
    {
      id: "refresh-rotated",
      label: "Rotate the refresh token (POST /refresh returns 200 and a new rt cookie)",
      lab: "02",
      hint: "Click Log in, then Refresh. Open the POST /refresh row in the Inspector and look at the Cookies tab: the rt value is new.",
      match: (e) => {
        const raw = e.res.headers["set-cookie"];
        return e.req.method === "POST" && e.req.path === "/refresh" && e.res.status === 200 && [raw ?? []].flat().some((c) => /^rt=[^;]+/.test(c));
      },
    },
    {
      id: "refresh-reuse-401",
      label: "Replay a spent refresh token and get a 401 from POST /refresh",
      lab: "02",
      hint: "A browser cannot replay an old cookie, so use the curl commands in the Reuse detection step: refresh twice with the same rt.",
      match: (e) => e.req.method === "POST" && e.req.path === "/refresh" && e.res.status === 401,
    },
  ],
  attacks: [],
};

export default lesson;
