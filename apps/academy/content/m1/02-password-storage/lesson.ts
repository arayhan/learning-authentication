import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l2",
  module: "m1",
  slug: "password-storage",
  title: "Storing Passwords",
  minutes: 20,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "hash", title: "Hash, don't store" },
    { id: "salt", title: "Salt and cost" },
    { id: "playground", title: "Playground" },
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
          prompt: "Why is a plain SHA-256 a poor way to store passwords?",
          choices: [
            "It is too slow for a login page",
            "It is built to be fast, so attackers can test billions of guesses per second",
            "Its output is too short to be unique",
            "It can be reversed with the right key",
          ],
          answer: 1,
          why: "SHA-256 is designed for speed. That is a virtue for file integrity and a flaw for passwords, because a GPU can try billions of candidates per second against a stolen hash.",
        },
        {
          prompt: "What does a unique random salt per password protect against?",
          choices: [
            "Precomputed (rainbow) tables, and spotting users who share a password",
            "An attacker who steals the database and guesses one weak password",
            "Someone sniffing the password on the network",
            "The need to use a slow hash at all",
          ],
          answer: 0,
          why: "A salt makes every hash unique, so one precomputed table cannot crack all users and equal passwords no longer look equal. It does not stop a targeted guess at a weak password, which is the slow hash's job, and it is not secret.",
        },
        {
          prompt: "Your PHC string starts with $argon2id$v=19$m=19456,t=2,p=1. Next year you raise the memory cost. What happens to existing users?",
          choices: [
            "Everyone is locked out until they reset their password",
            "You have to migrate the whole table offline first",
            "Old hashes still verify, because each string carries its own parameters; rehash at next login",
            "Their hashes now verify with the new cost, so nothing needs to happen",
          ],
          answer: 2,
          why: "Verification reads the parameters from the stored string, so old hashes keep working. When a user logs in with the correct password you hold the plaintext for a moment, which is the chance to rehash with the new cost.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "register-201",
      label: "Register an account: POST /register returns 201",
      lab: "01",
      hint: "Click Register alice in the console. A 409 means that address already exists, so use Register bob.",
      match: (e) => e.req.method === "POST" && e.req.path === "/register" && e.res.status === 201,
    },
    {
      id: "login-200",
      label: "Log in: POST /login returns 200",
      lab: "01",
      hint: "Click Log in as the account you registered.",
      match: (e) => e.req.method === "POST" && e.req.path === "/login" && e.res.status === 200,
    },
  ],
  attacks: [],
};

export default lesson;
