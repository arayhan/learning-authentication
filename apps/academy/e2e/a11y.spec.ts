import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { advance, register } from "./helpers";

const blocking = async (page: Page) =>
  (await new AxeBuilder({ page }).analyze()).violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);

test("axe: dashboard and m1-l3; keyboard drives SequenceFlow", async ({ page }) => {
  await register(page);
  expect(await blocking(page)).toEqual([]);

  await page.goto("/m/passwords-sessions/sessions-cookies");
  expect(await blocking(page)).toEqual([]);
  await advance(page, "hook"); // the SequenceFlow lives in "concept"

  const flow = page.getByRole("group", { name: /./ }).filter({ has: page.getByRole("button", { name: "Next", exact: true }) });
  await expect(flow).toBeVisible();
  expect(await blocking(page)).toEqual([]);

  // Tab walks through the diagram's message arrows first, then reaches Next (Back is disabled at step 1).
  const nextBtn = flow.getByRole("button", { name: "Next", exact: true });
  await flow.focus();
  for (let i = 0; i < 15 && !(await nextBtn.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(nextBtn).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(flow.getByText(/^Step 2 of/)).toBeVisible();
});
