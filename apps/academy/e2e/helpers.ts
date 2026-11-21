import { expect, type Page } from "@playwright/test";

export type QuizMeta = { id: string; questions: { choices: string[]; answer: number }[] };

export async function register(page: Page) {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Display name").fill("E2E Learner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
}

/** XP shown in the dashboard's XP bar. */
export async function dashboardXp(page: Page) {
  await page.goto("/");
  const text = await page.locator("main").getByText(/^\d+ XP/).innerText();
  return Number(/^(\d+) XP/.exec(text)![1]);
}

/** Click Continue on the active step and wait until that step shows as completed. */
export async function advance(page: Page, stepId: string) {
  await page.locator(`section[aria-labelledby="step-${stepId}"]`).getByRole("button", { name: /^(Continue|Finish lesson)$/ }).click();
  await expect(page.locator(`#step-${stepId}`).getByLabel("Completed")).toBeVisible();
}

/** Answer every question correctly using the lesson's own data. */
export async function passQuiz(page: Page, quiz: QuizMeta) {
  const q_ = page.getByRole("group", { name: "Quiz" }); // completed steps still show other "Next" buttons
  for (const [i, q] of quiz.questions.entries()) {
    await q_.getByRole("button", { name: q.choices[q.answer], exact: true }).click();
    await q_.getByRole("button", { name: i === quiz.questions.length - 1 ? "Finish" : "Next", exact: true }).click();
  }
  await expect(page.getByText("Quiz passed.")).toBeVisible();
}

export const taskDone = (page: Page, label: RegExp) => page.getByText(label).locator("..").getByText("(done)");
