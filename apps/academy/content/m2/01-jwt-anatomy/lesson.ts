import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l1",
  module: "m2",
  slug: "jwt-anatomy",
  title: "JWT Anatomy",
  minutes: 20,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "claims", title: "Claims" },
    { id: "tradeoff", title: "Sessions or tokens?" },
    { id: "check", title: "Check" },
    { id: "decode", title: "Decode a token" },
    { id: "code", title: "Code" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "A JWT's payload is base64url-encoded. What does that mean for the data inside it?",
          choices: [
            "It is encrypted, so only the server can read it",
            "Anyone who holds the token can decode and read it, so it must not contain secrets",
            "It is hashed, so it cannot be turned back into JSON",
            "It can only be read by the browser that received it",
          ],
          answer: 1,
          why: "Base64url is an encoding, not encryption. The signature stops anyone from changing the payload, but it does not hide it. Anything you put in a signed JWT is readable by every holder. (An encrypted JWT, called JWE, is a different format.)",
        },
        {
          prompt: "What does the signature of a JWT protect?",
          choices: [
            "The confidentiality of the claims",
            "The integrity and origin of the header and payload: a verifier can tell they were not changed and who signed them",
            "The token from being copied and replayed by someone else",
            "The token from ever expiring",
          ],
          answer: 1,
          why: "The signature is computed over the header and payload. Change one byte and verification fails. It says nothing about who is presenting the token: a copied token is just as valid, which is why a JWT is a bearer token.",
        },
        {
          prompt: "An API receives a JWT. Which fact alone shows that the token is meant for this API?",
          choices: [
            "The token is signed by a key the API trusts",
            "The sub claim holds a known user id",
            "The aud claim names this API",
            "The exp claim is in the future",
          ],
          answer: 2,
          why: "A valid signature only proves the issuer made the token. aud says which API it was made for. Without the check, a token issued for one service can be replayed against another service of the same issuer.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;
