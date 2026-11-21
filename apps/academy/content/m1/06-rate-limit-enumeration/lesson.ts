import type { LessonMeta } from "@/lib/course/types";

/** The JSON `error` field of a traced response body, or undefined. */
const errorOf = (body?: string): unknown => {
  try {
    return (JSON.parse(body ?? "") as { error?: unknown }).error;
  } catch {
    return undefined;
  }
};

const lesson: LessonMeta = {
  id: "m1-l6",
  module: "m1",
  slug: "rate-limit-enumeration",
  title: "Rate Limiting & Enumeration",
  minutes: 25,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "guessing", title: "Guessing attacks" },
    { id: "enumeration", title: "Account enumeration" },
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
          prompt: "Which pair of login responses lets an attacker find out which emails have accounts?",
          choices: [
            "401 invalid credentials for a wrong password, and the same 401 for an unknown email",
            "401 no such user for an unknown email, and 401 wrong password for a known one",
            "429 too many attempts for both known and unknown emails",
            "200 for a correct login and 401 for an incorrect one",
          ],
          answer: 1,
          why: "Any difference the attacker can observe, in the message, the status or the timing, is an oracle for account existence. A single generic message for both cases closes it. A 200 versus 401 for right and wrong credentials is unavoidable and reveals nothing about other accounts.",
        },
        {
          prompt: "Why does the lab verify a password against a dummy hash when the email is unknown?",
          choices: [
            "To protect the database from invalid queries",
            "So an unknown email takes as long as a wrong password, and timing does not reveal which emails exist",
            "To log the attacker's guess for later review",
            "Because argon2id refuses to run without a hash",
          ],
          answer: 1,
          why: "Verifying a real hash costs tens of milliseconds, while returning at once for an unknown email would take almost none. That difference is measurable over many requests. Burning the same time on a dummy hash makes both paths look alike.",
        },
        {
          prompt: "Why is a per-account failure limit alone not enough?",
          choices: [
            "Per-account limits are too slow to check",
            "Attackers can lock a victim out, so limits should not exist",
            "Password spraying: one common password tried across many accounts never trips any single account's limit",
            "Per-account limits only work for passwords shorter than 8 characters",
          ],
          answer: 2,
          why: "Spraying and credential stuffing spread attempts thin: a few tries per account across thousands of accounts. Add limits per IP or device, watch the overall failure rate, check passwords against breach lists and offer MFA.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "login-429",
      label: "Trigger the rate limit: a login attempt returns 429",
      lab: "01",
      hint: "Click Register, then click Wrong password six times. The sixth attempt inside the window is refused with a 429.",
      match: (e) => e.req.method === "POST" && e.req.path === "/login" && e.res.status === 429,
    },
    {
      id: "generic-401",
      label: 'A failed login returns the generic 401 body {"error":"invalid credentials"}',
      lab: "01",
      hint: "Click Wrong password and then Unknown email, and compare the two responses in the Inspector. They should be identical.",
      match: (e) => e.req.method === "POST" && e.req.path === "/login" && e.res.status === 401 && errorOf(e.res.body) === "invalid credentials",
    },
  ],
  attacks: [],
};

export default lesson;
