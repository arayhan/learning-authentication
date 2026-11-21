import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m3-l7",
  module: "m3",
  slug: "summary-boss",
  title: "OAuth 2.1 Summary & Boss",
  minutes: 15,
  steps: [{ id: "intro", title: "Intro" }],
  quizzes: [{ id: "boss", boss: { seconds: 600, passRatio: 0.8 }, questions: [{ prompt: "Placeholder question", choices: ["A", "B"], answer: 0, why: "Placeholder." }] }],
  labTasks: [],
  attacks: [],
};

export default lesson;
