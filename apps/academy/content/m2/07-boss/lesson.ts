import type { LessonMeta } from "@/lib/course/types";

const lesson: LessonMeta = {
  id: "m2-l7",
  module: "m2",
  slug: "boss",
  title: "Module 2 Boss",
  minutes: 15,
  steps: [{ id: "intro", title: "Intro" }],
  quizzes: [{ id: "boss", boss: { seconds: 600, passRatio: 0.8 }, questions: [{ prompt: "Placeholder question", choices: ["A", "B"], answer: 0, why: "Placeholder." }] }],
  labTasks: [],
  attacks: [],
};

export default lesson;
