import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l3",
  module: "m2",
  slug: "access-refresh",
  title: "Access & Refresh Tokens",
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
