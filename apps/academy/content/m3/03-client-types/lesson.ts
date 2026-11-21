import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l3",
  module: "m3",
  slug: "client-types",
  title: "Client Types",
  minutes: 20,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "implicit", title: "The implicit flow" },
    { id: "check", title: "Check" },
    { id: "code", title: "Code" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Which of these is a public client in the sense of RFC 6749?",
          choices: [
            "A Go backend that reads its secret from a vault",
            "A single-page app that runs entirely in the user's browser",
            "A server-rendered web app with a session cookie",
            "A scheduled job on a locked-down server",
          ],
          answer: 1,
          why: "RFC 6749 section 2.1 splits clients by whether they can keep a credential confidential, not by how important they are. Code that is delivered to the user's device, such as a SPA or a mobile app, can be read by the user, so it is public. A server process with a protected secret is confidential.",
        },
        {
          prompt: "Why did the OAuth 2.0 Security BCP (RFC 9700) and OAuth 2.1 retire the implicit flow?",
          choices: [
            "It needed too many round trips",
            "It did not work over HTTPS",
            "The access token was delivered in the redirect URL, where it leaks, with nothing binding it to the app, and the code flow with PKCE now covers the same apps better",
            "It could not carry scopes",
          ],
          answer: 2,
          why: "In the implicit flow the token itself came back in the URL fragment, exposed to history, extensions and injected scripts, and any party that obtained it could use it. The authorization code flow with PKCE keeps the token on the back channel and works for browser apps, so the implicit flow lost its reason to exist.",
        },
        {
          prompt: "A SPA team ships a client_secret inside its JavaScript bundle so that the app counts as a confidential client. What is wrong?",
          choices: [
            "Anyone who loads the page can read the secret, so it authenticates nothing. The app is a public client and should rely on PKCE",
            "Secrets are only allowed for mobile apps",
            "The secret expires when the bundle is cached",
            "Nothing: a minified bundle hides the secret well enough",
          ],
          answer: 0,
          why: "Whatever ships to the browser is readable. A secret there identifies nobody and gives a false sense of security. Declare the app a public client, register exact redirect URIs and protect the code with PKCE.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;
