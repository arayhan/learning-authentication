import { expect, test } from "@playwright/test";
import lesson from "../content/m1/03-sessions-cookies/lesson";
import { advance, dashboardXp, passQuiz, register, taskDone } from "./helpers";

test("m1-l3: quiz gate, lab task, XP and restored state", async ({ page }) => {
  await register(page);
  expect(await dashboardXp(page)).toBe(0);

  await page.goto("/m/passwords-sessions/sessions-cookies");
  for (const id of ["hook", "concept", "cookie", "server"]) await advance(page, id);

  // The gate holds until the quiz is passed.
  const cont = page.locator('section[aria-labelledby="step-check"]').getByRole("button", { name: "Continue" });
  await expect(cont).toBeDisabled();
  await passQuiz(page, lesson.quizzes[0]);
  await advance(page, "check");

  const console_ = page.getByText("Lab console").locator("../..");
  await console_.getByRole("button", { name: /Register/ }).click();
  await expect(console_.getByText("Register:")).toBeVisible();
  await console_.getByRole("button", { name: /Log in/ }).click();
  await expect(taskDone(page, /Log in and spot a Set-Cookie/)).toBeVisible();

  expect(await dashboardXp(page)).toBeGreaterThanOrEqual(4 * 10 + 20 + 10 + 15);

  await page.goto("/m/passwords-sessions/sessions-cookies");
  await expect(page.getByText("Quiz passed.")).toBeVisible();
  await expect(taskDone(page, /Log in and spot a Set-Cookie/)).toBeVisible();
  await expect(page.locator("#step-lab")).toBeFocused(); // lands on the first incomplete step
  expect(lesson.id).toBe("m1-l3");
});
