import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l7",
  module: "m3",
  slug: "summary-boss",
  title: "OAuth 2.1 Summary & Boss",
  minutes: 15,
  steps: [{ id: "intro", title: "Intro" }],
  quizzes: [
    {
      id: "boss",
      boss: { seconds: 600, passRatio: 0.8 },
      questions: [
        {
          prompt: "In the authorization code flow, which component is allowed to see the user's password?",
          choices: [
            "The client, so it can sign in on the user's behalf",
            "Only the authorization server, where the user signs in",
            "The resource server, to check it on each API call",
            "Both the client and the authorization server",
          ],
          answer: 1,
          why: "Keeping the password away from the client is the point of delegation. The user signs in at the authorization server, and the client only ever receives a code and then a token limited to what the user approved.",
        },
        {
          prompt: "Which step of the authorization code flow uses the back channel?",
          choices: [
            "The redirect to /authorize",
            "The login and consent page",
            "The redirect back to the client with ?code=",
            "The client's POST /token that exchanges the code for tokens",
          ],
          answer: 3,
          why: "The first three steps pass through the user's browser, the front channel. The token request is a direct HTTP call from the client to the authorization server, so the access token never appears in a URL.",
        },
        {
          prompt: "With PKCE, which value stays inside the client and which is sent to /authorize?",
          choices: [
            "The challenge stays, the verifier is sent",
            "The verifier stays until /token, and only its S256 hash, the challenge, is sent to /authorize",
            "Both are sent to /authorize",
            "Neither: PKCE values only travel to /token",
          ],
          answer: 1,
          why: "The challenge is the commitment, the verifier is the proof. The proof is shown only on the back-channel request, after the code has been issued, so someone who saw the front channel has the commitment but cannot make the proof.",
        },
        {
          prompt: "Which list is what OAuth 2.1 (draft) changes compared to OAuth 2.0 as written in RFC 6749?",
          choices: [
            "PKCE is required for the authorization code flow, the implicit and password grants are removed, and redirect URIs are matched exactly",
            "JWT access tokens are required, and refresh tokens are removed",
            "State is removed, because PKCE replaces it in every case",
            "Client credentials is removed, and all clients must be public",
          ],
          answer: 0,
          why: "OAuth 2.1 consolidates RFC 6749 with the lessons of RFC 7636 and RFC 9700. It does not mandate a token format, it keeps refresh tokens and client credentials, and it still expects clients to protect against forged callbacks, with either state or PKCE.",
        },
        {
          prompt: "What can an attacker do to a client that never checks state on the callback?",
          choices: [
            "Read the user's password from the callback URL",
            "Decrypt the access token",
            "Hand the victim's browser a callback URL with the attacker's own code, so the victim is signed in to the attacker's account",
            "Change the scope that the user approved",
          ],
          answer: 2,
          why: "Without a check that ties the response to a request this browser started, the client cannot tell its own response from a forged one. Anything the victim then stores through the client lands in the attacker's account.",
        },
        {
          prompt: "A server compares redirect URIs by prefix, and the registered one is https://app.example/callback. What does an attacker request?",
          choices: [
            "The same URI with a different scope",
            "A lookalike such as https://app.example/callback.evil, so the code is delivered to a URL they control",
            "A URI with http instead of https only",
            "Nothing: prefix matching is safe when HTTPS is used",
          ],
          answer: 1,
          why: "Prefix, wildcard and substring checks accept URIs the owner never registered. Exact string comparison is required by RFC 6749, repeated in RFC 9700 and in OAuth 2.1. The lab's vulnerable mode shows the bypass.",
        },
        {
          prompt: "A valid token has scope=profile, and the API needs photos.read for GET /api/photos. What should the API return?",
          choices: [
            "401 with error=invalid_token",
            "200 with an empty list",
            "302 to the authorization server",
            "403 with error=insufficient_scope",
          ],
          answer: 3,
          why: "The token is valid, so this is not an authentication failure. RFC 6750 section 3.1 reserves 401 for missing or invalid tokens and 403 insufficient_scope for a valid token that lacks the needed scope.",
        },
        {
          prompt: "Which statement about the client credentials grant is correct?",
          choices: [
            "It needs the user to approve on a consent page",
            "It returns an ID token that names the user",
            "It lets a confidential client get a token for itself, authenticated with its own secret, with no user involved",
            "It is the recommended grant for single-page apps",
          ],
          answer: 2,
          why: "The token's subject is the client, there is no resource owner and no consent. It suits server-to-server calls, and it must never be used from code that cannot keep the secret, such as a browser app.",
        },
        {
          prompt: "What does RFC 8252 tell native apps to do for sign-in?",
          choices: [
            "Show the authorization server's login page inside an embedded web view, so the app controls the screen",
            "Collect the password in the app and send it to the token endpoint",
            "Use the implicit flow, because a phone cannot do a back-channel call",
            "Use the system browser with the authorization code flow and PKCE, and a redirect that only the app can receive, preferably a claimed https link",
          ],
          answer: 3,
          why: "An embedded web view lets the app read the user's password and cookies. The system browser keeps the sign-in out of the app's reach, and PKCE covers the case where another app also receives the redirect, as custom schemes allow.",
        },
        {
          prompt: "An authorization code is presented to /token a second time. What should the server do?",
          choices: [
            "Reject it and, where possible, revoke the tokens that were already issued from that code",
            "Issue a new token, since the code is genuine",
            "Return the same token again so a retry is harmless",
            "Accept it if the second request comes from the same IP address",
          ],
          answer: 0,
          why: "A code is single-use. A repeat means it has been seen by someone else as well, so the safe response is to refuse and to withdraw what the first redemption produced. The lab does this and answers invalid_grant.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;
