import { expect, test } from "@playwright/test";
import lesson from "../content/m2/05-jwt-attacks/lesson";
import { advance, dashboardXp, passQuiz, register } from "./helpers";

test("m2-l5: three live JWT attacks tick", async ({ page }) => {
  await register(page);
  await page.goto("/m/jwt-tokens/jwt-attacks");
  for (const id of ["hook", "concept", "flaws"]) await advance(page, id);
  await passQuiz(page, lesson.quizzes[0]);
  await advance(page, "check");

  for (const a of lesson.attacks) {
    const card = page.getByRole("region", { name: new RegExp(a.id === "alg-none" ? "alg: none" : a.id === "expired" ? "Expired token" : "key confusion", "i") });
    await card.getByRole("button", { name: `Run ${a.id}` }).click();
    await expect(card.getByText("Same token, opposite outcome")).toBeVisible();
  }
  // 3 attacks (30 XP each) + 3 steps + quiz + the check step.
  await expect.poll(() => dashboardXp(page)).toBeGreaterThanOrEqual(3 * 30 + 4 * 10 + 20);
});
