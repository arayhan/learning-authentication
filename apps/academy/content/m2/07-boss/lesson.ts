import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l7",
  module: "m2",
  slug: "boss",
  title: "Module 2 Boss",
  minutes: 15,
  steps: [{ id: "intro", title: "Intro" }],
  quizzes: [
    {
      id: "boss",
      boss: { seconds: 600, passRatio: 0.8 },
      questions: [
        {
          prompt: "A developer puts a user's home address and date of birth in the JWT payload 'because the token is signed'. What is wrong with that?",
          choices: [
            "Signed tokens cannot carry more than three claims",
            "The signature will no longer verify once personal data is added",
            "The payload is only encoded, so everyone who holds the token can read the address and date of birth",
            "Personal data must go in the header, not the payload",
          ],
          answer: 2,
          why: "Signing gives integrity, not confidentiality. A normal JWT payload is base64url JSON that anyone holding the token can decode. Keep it free of sensitive data, or use an encrypted token or a server-side lookup.",
        },
        {
          prompt: "An API receives a token with a valid signature from the right issuer, and an exp in the future. Its aud names a different service. What should the API do?",
          choices: [
            "Reject it: the token was issued for another audience",
            "Accept it: the signature and the issuer are correct",
            "Accept it, but log a warning",
            "Reject it only if the user is an administrator",
          ],
          answer: 0,
          why: "aud says which API a token is for. Without that check, a token minted for one service of an issuer opens every other service of the same issuer. RFC 8725 requires the audience to be validated.",
        },
        {
          prompt: "One identity provider issues tokens and six independent services must verify them. Which choice limits the damage if one service is compromised?",
          choices: [
            "HS256 with the same secret in all six services",
            "HS256 with a different secret in every service, all known to the provider",
            "Unsigned tokens over TLS",
            "RS256 or ES256, with only the provider holding the private key and the services using the public key",
          ],
          answer: 3,
          why: "A shared HMAC secret lets every verifier forge tokens. With an asymmetric pair, a compromised service exposes only a public key that cannot sign.",
        },
        {
          prompt: "Where should an API obtain the key it uses to verify an incoming token?",
          choices: [
            "From the jku header in the token, which names the right key set",
            "From the JWKS URL configured for the trusted issuer, cached and refetched on an unknown kid",
            "From a jwk header embedded in the token",
            "From a query parameter on the request",
          ],
          answer: 1,
          why: "Everything in the token is attacker-controlled until verified, including jku, x5u and embedded jwk headers. Keys must come from trust you configured. The token's kid only selects among keys you already trust.",
        },
        {
          prompt: "The issuer is rotating its signing key. Which order avoids an outage?",
          choices: [
            "Remove the old key, then add the new key to the JWKS",
            "Switch to signing with the new key, then publish its public key",
            "Publish the new public key, start signing with it, and retire the old key after the old tokens expire",
            "Reuse the old kid for the new key so nothing changes for verifiers",
          ],
          answer: 2,
          why: "Verifiers must be able to find the new key before tokens signed with it appear, and the old key must stay until tokens signed with it have expired. A distinct kid per key is what lets both coexist.",
        },
        {
          prompt: "Why is the lab's refresh cookie scoped with Path=/refresh?",
          choices: [
            "So the cookie is encrypted by the browser",
            "Because cookies without a Path are rejected by browsers",
            "To make the cookie last longer",
            "So the browser sends it only to the refresh and logout endpoints, not with every API call",
          ],
          answer: 3,
          why: "The refresh token is powerful and needed in only one place. Scoping the path keeps it off ordinary API requests, so it cannot leak through the many handlers and logs that never need it.",
        },
        {
          prompt: "In a browser app that follows the lab's pattern, where do the two tokens live?",
          choices: [
            "Both in localStorage so they survive reloads",
            "The access token in memory, the refresh token in an HttpOnly cookie",
            "The access token in an HttpOnly cookie, the refresh token in localStorage",
            "Both in a JavaScript global so the code can reach them easily",
          ],
          answer: 1,
          why: "Memory and HttpOnly cookies cannot be read out by an injected script. The access token is short-lived and rebuilt after reload by a call to refresh, and the cookie carries the long-lived one.",
        },
        {
          prompt: "Which statement about XSS and HttpOnly cookies is correct?",
          choices: [
            "HttpOnly makes the application immune to XSS",
            "HttpOnly stops scripts from calling the API",
            "HttpOnly stops a script from reading the cookie, but the script can still make requests that carry it while the page is open",
            "HttpOnly cookies are not sent on requests made by scripts",
          ],
          answer: 2,
          why: "HttpOnly removes the cookie from document.cookie, so it cannot be copied away. Requests from the page still carry it, so an XSS bug can act as the user for as long as the page is open.",
        },
        {
          prompt: "Your verifier calls verify(token, publicKey) with no list of allowed algorithms. An attacker sends an HS256 token signed with your public key as the secret. Why might it be accepted?",
          choices: [
            "RSA public keys are always valid HMAC secrets",
            "The library checks the signature only if the algorithm is RS256",
            "HMAC signatures are not checked by libraries",
            "The library follows the token's alg header, so it computes an HMAC with the same key bytes the attacker used",
          ],
          answer: 3,
          why: "That is key confusion. The public key is public, so the attacker can sign with it. A verifier that lets the header choose the algorithm and reuses one key variable for all of them recomputes the same HMAC. Pinning the algorithm closes it.",
        },
        {
          prompt: "A compromised admin account must stop working within seconds, but access tokens last five minutes. Which design meets that?",
          choices: [
            "Check a deny list or a per-user valid-after timestamp on each API call, as well as revoking the refresh token",
            "Revoke only the refresh token: that cancels access tokens too",
            "Ask the user to clear their browser storage",
            "Shorten the refresh token lifetime to one day",
          ],
          answer: 0,
          why: "Revoking the refresh token stops new access tokens, but existing ones live until exp. Only a server-side check on each request can reject a still-valid token sooner. The cost is a lookup per call, which is justified for high-risk accounts.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;
