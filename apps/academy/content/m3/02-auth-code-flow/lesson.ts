import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l2",
  module: "m3",
  slug: "auth-code-flow",
  title: "Authorization Code Flow",
  minutes: 15,
  steps: [
    { id: "hook", title: "Hook" },
    { id: "concept", title: "Concept" },
    { id: "check", title: "Check" },
    { id: "recap", title: "Recap" },
  ],
  quizzes: [{ id: "q1", questions: [{ prompt: "Placeholder question", choices: ["A", "B"], answer: 0, why: "Placeholder." }] }],
  labTasks: [],
  attacks: [],
};

export default lesson;
