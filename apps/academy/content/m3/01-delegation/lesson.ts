import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l1",
  module: "m3",
  slug: "delegation",
  title: "The Delegation Problem",
  minutes: 20,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "roles", title: "The four roles" },
    { id: "check", title: "Check" },
    { id: "code", title: "Code" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "A photo-printing site wants to read your photos at another service. Which approach is the problem OAuth 2.0 was created to remove?",
          choices: [
            "Giving the printing site your password for the photo service",
            "Giving the printing site a token that only allows reading photos",
            "Approving a consent screen shown by the photo service",
            "Letting the token expire after a few minutes",
          ],
          answer: 0,
          why: "A shared password hands over everything: the site can do anything you can, you cannot take access back without changing the password, and a breach of the site leaks the password. OAuth replaces it with a scoped, expiring, revocable token that the user approves.",
        },
        {
          prompt: "In RFC 6749 terms, which role issues the access token?",
          choices: [
            "The resource owner, because it is their data",
            "The client, because it asked for access",
            "The resource server, because it holds the photos",
            "The authorization server, after authenticating the user and getting their consent",
          ],
          answer: 3,
          why: "RFC 6749 names four roles. The resource owner is the user, the client is the app, the resource server hosts the data and checks tokens, and the authorization server authenticates the user, collects consent and issues the token. In small systems the last two can share a process, but they are separate roles.",
        },
        {
          prompt: "A client presents a valid access token with the scope photos.read. What does that token tell the API?",
          choices: [
            "That the person using the app just typed their password",
            "That an authority granted this client the access named by its scope, for a limited time",
            "That the client is trustworthy and may call any endpoint",
            "That the user is currently present at the keyboard",
          ],
          answer: 1,
          why: "OAuth 2.0 is an authorization framework: a token is a grant of access to a client, not proof that the user is present. Proving who signed in is a different job, done by OpenID Connect on top of OAuth. Mixing the two up is a classic design error.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;
