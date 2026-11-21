import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l1",
  module: "m1",
  slug: "identity",
  title: "Identity, Authentication, Authorization",
  minutes: 15,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "check", title: "Check" },
    { id: "code", title: "Code" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "A user submits the correct password. What has the system just established?",
          choices: [
            "Authentication: it knows who the caller is",
            "Authorization: it knows what the caller may do",
            "Both, because a password also grants permissions",
            "Neither, a session has to exist first",
          ],
          answer: 0,
          why: "A password proves identity. What that identity may do is a separate decision made on every request.",
        },
        {
          prompt: "A signed-in user opens another customer's invoice and gets a 403. Which check refused the request?",
          choices: ["Authentication", "Authorization", "Password hashing", "Rate limiting"],
          answer: 1,
          why: "The server knew who the caller was (authentication) and decided they may not read that invoice (authorization).",
        },
        {
          prompt: "Which of these is an authorization failure rather than an authentication failure?",
          choices: [
            "The password does not match the stored hash",
            "The session cookie has expired",
            "A signed-in user calls an admin-only endpoint",
            "The email address is not registered",
          ],
          answer: 2,
          why: "The other three are all failures to prove who the caller is. Only the admin-only call involves a known caller who is not allowed.",
        },
      ],
    },
  ],
  labTasks: [],
  attacks: [],
};

export default lesson;
