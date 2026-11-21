import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l6",
  module: "m2",
  slug: "revocation",
  title: "Revocation",
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
