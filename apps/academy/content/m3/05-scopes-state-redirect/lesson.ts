import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l5",
  module: "m3",
  slug: "scopes-state-redirect",
  title: "Scopes, State & Redirects",
  minutes: 35,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Scopes" },
    { id: "state", title: "State" },
    { id: "redirect", title: "Redirect URIs" },
    { id: "check", title: "Check" },
    { id: "lab", title: "Lab" },
    { id: "breakit", title: "Break it" },
    { id: "code", title: "Code" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "A token carries scope=profile only, and the API's photos endpoint needs photos.read. Where is that decided, and what does the API answer?",
          choices: [
            "At the consent page, which hides the endpoint from the client",
            "At the resource server, on every request, from the token's scope. It answers 403 with error=insufficient_scope",
            "By the client, which promises not to call the endpoint",
            "At the resource server, which answers 401 invalid_token",
          ],
          answer: 1,
          why: "A scope is only a claim in a token. It protects nothing until the resource server reads it and refuses what it does not cover. RFC 6750 section 3.1 uses 403 insufficient_scope for a valid token that lacks the scope, and 401 invalid_token for a token that is not valid at all.",
        },
        {
          prompt: "What should a client do with the state parameter?",
          choices: [
            "Bind an unguessable value to the user's browser session before redirecting, and reject any callback whose state does not match it",
            "Send it and ignore the answer, since the server verifies it",
            "Use the user's id as the state so the server can look the user up",
            "Reuse one fixed state for all users so it can be cached",
          ],
          answer: 0,
          why: "State ties a response to a request this browser really started. Without that check an attacker can hand a victim's browser a callback URL carrying the attacker's own code, and the victim ends up signed in as the attacker. The value must be unguessable and tied to the session.",
        },
        {
          prompt: "The registered redirect URI is https://app.example/callback. An exact-match server compares each request's redirect_uri to it. Which one is accepted?",
          choices: [
            "https://app.example/callback/../evil",
            "https://app.example/callback.evil",
            "https://app.example/callback",
            "https://app.example/callback?next=//evil.example",
          ],
          answer: 2,
          why: "RFC 6749 and OAuth 2.1 require an exact string comparison. Prefix, wildcard and substring matching are how attackers slip a lookalike URI past the check and get the code delivered to a URL they control.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "api-403-scope",
      label: "Call the API with a token that lacks photos.read and get 403 insufficient_scope",
      lab: "03",
      hint: "Request scope=profile only, finish the flow with curl as shown in the Lab step, then call GET /api/photos with that token.",
      match: (e) => e.role === "api" && e.req.method === "GET" && e.req.path === "/api/photos" && e.res.status === 403 && (e.res.body ?? "").includes("insufficient_scope"),
    },
    {
      id: "authorize-400-redirect",
      label: "Send an unregistered redirect_uri and get an error page, not a redirect (GET /authorize returns 400)",
      lab: "03",
      hint: "Put a redirect_uri that is not registered, for example the .evil one, in the URL builder, leave vulnerable mode unticked and open it.",
      match: (e) => e.role === "as" && e.req.method === "GET" && e.req.path === "/authorize" && e.res.status === 400,
    },
  ],
  attacks: [{ id: "redirect-prefix", title: "Redirect URI prefix match", kind: "live" }],
};

export default lesson;
