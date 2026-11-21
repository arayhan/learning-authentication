import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m1-l4",
  module: "m1",
  slug: "session-lifecycle",
  title: "Session Lifecycle",
  minutes: 25,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "lifecycle", title: "Birth to death" },
    { id: "rotation", title: "Rotate on login" },
    { id: "session-fixation", title: "Session fixation" },
    { id: "check", title: "Check" },
    { id: "lab", title: "Lab" },
    { id: "code", title: "Code" },
    { id: "breakit", title: "Break it" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [
    {
      id: "q1",
      questions: [
        {
          prompt: "When must the server issue a brand-new session id?",
          choices: [
            "Only when the cookie expires",
            "On every request, for maximum safety",
            "Never, the id should stay stable for the whole visit",
            "At login and at any other privilege change, such as a password change or step-up",
          ],
          answer: 3,
          why: "Any id that existed before a privilege change might be known to someone else. A new id at login and on each privilege change makes whatever an attacker learned earlier worthless. Rotating on every request breaks parallel tabs and gains nothing.",
        },
        {
          prompt: "In a session fixation attack, how does the attacker get into the victim's account without ever seeing their cookie or password?",
          choices: [
            "The attacker picked the session id, and the vulnerable server kept it after the victim logged in",
            "The attacker guesses the victim's password from the id",
            "The attacker reads the id out of the victim's browser with XSS",
            "The attacker intercepts the Set-Cookie header on the network",
          ],
          answer: 0,
          why: "Fixation reverses the usual theft. The attacker chooses the id and gets it into the victim's browser. If login keeps that id, it becomes an authenticated session that the attacker already holds.",
        },
        {
          prompt: "A user clicks Logout. Which behavior is secure?",
          choices: [
            "Delete the cookie in the browser only",
            "Redirect to the login page and keep the session until it expires",
            "Mark the user as logged out in the page's JavaScript state",
            "Delete the session on the server and clear the cookie",
          ],
          answer: 3,
          why: "A copied cookie keeps working until the server forgets it. Logout has to destroy the server-side session. Clearing the browser's cookie is just tidying up.",
        },
      ],
    },
  ],
  labTasks: [
    {
      id: "logout-204",
      label: "Log out: POST /logout returns 204",
      lab: "01",
      hint: "Click Register, then Log in, then click Log out. The console sends the CSRF token for you. Then click Whoami again to see the session is gone.",
      match: (e) => e.req.method === "POST" && e.req.path === "/logout" && e.res.status === 204,
    },
  ],
  attacks: [{ id: "fixation", title: "Session fixation", kind: "live" }],
};

export default lesson;
