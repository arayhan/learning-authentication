import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l4",
  module: "m3",
  slug: "pkce",
  title: "PKCE",
  minutes: 35,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "generator", title: "Make a challenge" },
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
          prompt: "With PKCE and S256, what does the client send in the /authorize request?",
          choices: [
            "The code_verifier itself",
            "code_challenge = BASE64URL(SHA-256(code_verifier)) with code_challenge_method=S256",
            "The client_secret, to prove who it is",
            "A signature of the verifier made with a private key",
          ],
          answer: 1,
          why: "The verifier is a random secret that stays in the client. Only its SHA-256 hash, base64url encoded, goes out in the front channel. Because the hash is one-way, seeing the challenge does not let anyone produce the verifier.",
        },
        {
          prompt: "An attacker steals an authorization code from the redirect URL, but never sees the verifier. What happens when they call /token?",
          choices: [
            "A token is issued, because the code is valid",
            "A token is issued, but with fewer scopes",
            "The server asks the user to approve again",
            "The server answers invalid_grant, because the missing verifier does not hash to the stored challenge",
          ],
          answer: 3,
          why: "The code is bound to the challenge that was sent with the authorization request. Without a verifier that hashes to it, redemption fails. In the lab the failed attempt does not burn the code, so a thief cannot lock the real app out either.",
        },
        {
          prompt: "Why is code_challenge_method=plain discouraged?",
          choices: [
            "Servers cannot store it",
            "It is slower than S256",
            "The challenge equals the verifier, so anyone who could see the authorization request, which is the same exposure PKCE guards against, can redeem the code",
            "plain verifiers must be shorter than 43 characters",
          ],
          answer: 2,
          why: "PKCE exists because the front channel can be observed. With plain, the secret travels through that very channel. RFC 7636 allows plain only for clients that technically cannot hash, and RFC 9700 says to use S256.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "token-400-bad-verifier",
      label: "Redeem with a wrong verifier and get invalid_grant (POST /token returns 400)",
      lab: "03",
      hint: "Click Test a wrong verifier in the generator. To test against a real code, paste the code into the generator first, or use the curl command in the Lab step.",
      match: (e) => e.role === "as" && e.req.method === "POST" && e.req.path === "/token" && e.res.status === 400 && (e.req.body ?? "").includes("grant_type=authorization_code") && (e.req.body ?? "").includes("code_verifier=") && (e.res.body ?? "").includes("invalid_grant"),
    },
  ],
  attacks: [{ id: "code-interception", title: "Authorization code interception", kind: "live" }],
};

export default lesson;
