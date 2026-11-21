import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l5",
  module: "m2",
  slug: "jwt-attacks",
  title: "Attacking JWT Verification",
  minutes: 30,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "flaws", title: "The attack catalogue" },
    { id: "check", title: "Check" },
    { id: "breakit", title: "Break it" },
    { id: "code", title: "Code" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "Why must a verifier choose the allowed algorithms itself instead of reading alg from the token?",
          choices: [
            "The alg header is chosen by whoever built the token, so an attacker can ask for none or for a weaker algorithm",
            "Reading the header is slower than a fixed configuration",
            "The alg header is encrypted and cannot be read before verification",
            "Most libraries do not support more than one algorithm",
          ],
          answer: 0,
          why: "The header is part of the untrusted input. A verifier that follows it lets the attacker pick the check that will be applied to their own token. RFC 8725 says the verifier must pin the algorithms it accepts.",
        },
        {
          prompt: "How does the RS256 to HS256 key confusion attack work?",
          choices: [
            "The attacker breaks RSA by factoring the public key",
            "The attacker steals the private key from the JWKS endpoint",
            "The attacker replaces the signature with random bytes",
            "The attacker signs a token with HS256, using the server's public key as the HMAC secret, and sets alg to HS256 so a careless verifier does the same",
          ],
          answer: 3,
          why: "The public key is public, so the attacker can use it as an HMAC secret. A verifier that picks the algorithm from the header, and hands its one 'key' variable to whichever algorithm is asked for, will check the forgery with the same bytes and accept it.",
        },
        {
          prompt: "A token has a valid RS256 signature from your own issuer, but its exp passed an hour ago. Your API only verifies the signature. What goes wrong?",
          choices: [
            "Nothing: a valid signature is all that matters",
            "The expired token is accepted, so a stolen token never stops working, and tokens made for other audiences are accepted too",
            "The API crashes because exp is in the past",
            "The signature stops verifying once exp passes",
          ],
          answer: 1,
          why: "A signature only proves the issuer made the token at some point. Whether it is still valid, and whether it was meant for this API, is carried by exp, aud and iss, and the verifier has to check them. Skipping them turns every old or foreign token into a working one.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [
    { id: "alg-none", title: "alg: none forgery", kind: "live" },
    { id: "key-confusion", title: "RS256 to HS256 key confusion", kind: "live" },
    { id: "expired", title: "Expired token accepted", kind: "live" },
  ],
};

export default lesson;
