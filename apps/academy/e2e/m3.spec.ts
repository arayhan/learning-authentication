import { expect, test } from "@playwright/test";
import lesson from "../content/m3/02-auth-code-flow/lesson";
import { advance, passQuiz, register, taskDone } from "./helpers";

test("m3-l2: run the flow in the SPA tab, 3 lab tasks tick", async ({ page, context }) => {
  await register(page);
  await page.goto("/m/oauth2-pkce/auth-code-flow");
  for (const id of ["hook", "concept"]) await advance(page, id);
  await passQuiz(page, lesson.quizzes[0]);
  await advance(page, "check");

  const spa = await context.newPage();
  await spa.goto("http://localhost:4113");
  await spa.getByRole("button", { name: "Sign in with Demo AS" }).click();
  await spa.getByLabel("Email").fill("alice@example.com");
  await spa.getByLabel("Password").fill("correct-horse-battery");
  await spa.getByRole("button", { name: "Sign in" }).click();
  await spa.getByRole("button", { name: "Approve" }).click();
  await expect(spa.getByText("GET /api/photos → 200")).toBeVisible();
  await spa.close();

  for (const t of lesson.labTasks) await expect(taskDone(page, new RegExp(t.label.slice(0, 20).replace(/[()]/g, "\$&")))).toBeVisible();
});
