import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l6",
  module: "m3",
  slug: "client-credentials",
  title: "Client Credentials",
  minutes: 25,
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
          prompt: "Which grant fits a nightly backend job that reads data when no user is present?",
          choices: [
            "Client credentials",
            "Authorization code with PKCE",
            "Implicit",
            "Resource owner password credentials",
          ],
          answer: 0,
          why: "Client credentials (RFC 6749 section 4.4) lets a confidential client get a token for itself using its own secret, with no browser and no consent. The authorization code flow needs a user at a browser, and the implicit and password grants are gone from OAuth 2.1.",
        },
        {
          prompt: "RFC 6749 says a client credentials response should not include a refresh token. Why?",
          choices: [
            "Refresh tokens cannot be sent with HTTP Basic authentication",
            "The client can authenticate again at any moment, so a long-lived refresh token adds risk and no convenience",
            "Access tokens from this grant never expire",
            "Refresh tokens only work for JWT access tokens",
          ],
          answer: 1,
          why: "A refresh token exists so a user does not have to sign in again. Here there is no user: the client simply repeats the request with its secret when the access token expires. An extra long-lived credential would only be one more thing to steal.",
        },
        {
          prompt: "A service wants alice's photos using only client credentials. What is the problem?",
          choices: [
            "The token would be rejected by every API",
            "Client credentials only works over HTTP, not HTTPS",
            "The photos would arrive without scopes",
            "The token identifies the client itself (its sub is the client id), not alice, so it cannot stand for her. User data needs a flow where she consents",
          ],
          answer: 3,
          why: "With client credentials there is no resource owner. The token says what the client may do as itself. If an API treated such a token as a user's, any backend with a secret could read any user's data. Use the authorization code flow when the user is the point.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "client-credentials-200",
      label: "Get a token for the backend client (POST /token with grant_type=client_credentials returns 200)",
      lab: "03",
      hint: "Click Get a token in the console. It sends demo-backend's id and secret as HTTP Basic.",
      match: (e) => e.role === "as" && e.req.method === "POST" && e.req.path === "/token" && e.res.status === 200 && (e.req.body ?? "").includes("grant_type=client_credentials") && (e.res.body ?? "").includes("access_token"),
    },
  ],
  attacks: [],
};

export default lesson;
