import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l2",
  module: "m2",
  slug: "signing-jwks",
  title: "Signing & JWKS",
  minutes: 25,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "algorithms", title: "Algorithms" },
    { id: "jwks", title: "Publishing keys" },
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
          prompt: "Five services must verify tokens from one identity provider. Which setup keeps the signing power smallest?",
          choices: [
            "HS256 with the same secret copied to all five services",
            "RS256 or ES256: only the identity provider holds the private key, the five services hold the public key",
            "RS256 with the private key copied to all five services",
            "No signature, and rely on TLS between the services",
          ],
          answer: 1,
          why: "With a shared HMAC secret every verifier can also mint tokens, so one compromised service breaks them all. With an asymmetric pair, verifying needs only the public key, and only the issuer can sign.",
        },
        {
          prompt: "Why is it safe to serve the JWKS to anyone, with no authentication?",
          choices: [
            "Because the keys in it are encrypted",
            "Because browsers refuse to read it unless the origin is allowed",
            "Because it contains only public keys, which can verify signatures but cannot create them",
            "Because the JWKS endpoint is rate limited",
          ],
          answer: 2,
          why: "A JWKS lists public keys. Knowing a public key does not let anyone sign. Publishing it is the point: any verifier can fetch it without a secret.",
        },
        {
          prompt: "The issuer rotates to a new signing key. What must a verifier do when it sees a token with an unknown kid?",
          choices: [
            "Reject the token for ever",
            "Accept the token because the signature algorithm is valid",
            "Refetch the JWKS (with some rate limit) and look for that kid again",
            "Pick any key from its cache and try them in turn until one works",
          ],
          answer: 2,
          why: "kid exists so a verifier can find the right key, and a new kid usually means a rotation. A cached JWKS with a refetch on unknown kid lets keys rotate without restarting services. A rate limit on refetching stops attackers from forcing a request storm with random kids.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "jwks-fetched",
      label: "Fetch the public keys: GET /.well-known/jwks.json returns 200",
      lab: "02",
      hint: "Click Fetch JWKS. Check the response: one RSA key with a kid, alg RS256 and use sig.",
      match: (e) => e.req.method === "GET" && e.req.path === "/.well-known/jwks.json" && e.res.status === 200,
    },
  ],
  attacks: [],
};

export default lesson;
