// pnpm shots: starts lab01 and lab03 (Go) if they are not already up and captures the lesson screenshots.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { killOnExit, killTree, spawnTree } from "./proc.mjs";

const root = resolve(__dirname, "..");
const out = resolve(root, "apps/academy/public/shots");
// @playwright/test is an academy dependency, so resolve it from there.
const { chromium } = createRequire(resolve(root, "apps/academy/package.json"))("@playwright/test") as typeof import("@playwright/test");

const up = (url: string) => fetch(url).then((r) => r.ok, () => false);
const children: ReturnType<typeof spawnTree>[] = [];
killOnExit(children);

async function ensureLab(n: string, port: number) {
  const health = `http://127.0.0.1:${port}/healthz`;
  if (await up(health)) return;
  children.push(spawnTree("node", ["scripts/lab.mjs", n, "--go"], { cwd: root, env: {}, stdio: "ignore" }));
  for (let i = 0; i < 240 && !(await up(health)); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await up(health))) throw new Error(`lab ${n} did not come up`);
}

async function main() {
  mkdirSync(out, { recursive: true });
  await ensureLab("01", 4101);
  await ensureLab("03", 4103);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
  const page = await ctx.newPage();
  const shot = (name: string, p = page) => p.screenshot({ path: resolve(out, name) });

  // Lab 01: login page, then the HttpOnly cookie as JavaScript sees it versus as the browser stores it.
  const email = `shots-${Date.now()}@example.com`;
  await page.goto("http://localhost:4101");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#out").filter({ hasText: "POST /register" }).waitFor();
  await page.getByRole("button", { name: "Log in" }).click();
  await page.locator("#out").filter({ hasText: "POST /login" }).waitFor();
  await shot("lab01-login.png");

  const jsSees = await page.evaluate(() => document.cookie);
  const cdp = await ctx.newCDPSession(page);
  const { cookies } = (await cdp.send("Network.getCookies", { urls: ["http://localhost:4101"] })) as { cookies: { name: string; httpOnly: boolean; sameSite?: string; path: string }[] };
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt" }[c]};`);
  const rows = cookies.map((c) => `<tr><td>${esc(c.name)}</td><td>${c.httpOnly ? "&#10003;" : ""}</td><td>${esc(c.sameSite ?? "")}</td><td>${esc(c.path)}</td></tr>`).join("");
  const view = await ctx.newPage();
  await view.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{font:15px/1.5 Inter,system-ui,sans-serif;margin:0;padding:48px;background:#fafafa;color:#18181b}
    h2{font-size:14px;margin:0 0 8px;color:#52525b;font-weight:600}
    pre,table{background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin:0 0 32px;font:14px ui-monospace,Consolas,monospace}
    table{border-collapse:collapse;width:100%;padding:0}td,th{padding:8px 16px;text-align:left;border-bottom:1px solid #e4e4e7}th{color:#52525b;font-weight:600}
  </style>
  <h2>Console: document.cookie</h2><pre>&gt; document.cookie\n"${esc(jsSees)}"</pre>
  <h2>Application &rarr; Cookies (what the browser stores)</h2>
  <table><tr><th>Name</th><th>HttpOnly</th><th>SameSite</th><th>Path</th></tr>${rows}</table>`);
  await shot("lab01-devtools-cookie.png", view);
  await view.close();

  // Lab 03: SPA -> AS sign-in -> consent -> back in the SPA with the finished flow.
  await page.goto("http://localhost:4113");
  await page.getByRole("button", { name: "Sign in with Demo AS" }).click();
  await page.getByLabel("Email").waitFor();
  await shot("lab03-login.png");
  await page.getByLabel("Email").fill("alice@example.com");
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Approve" }).waitFor();
  await shot("lab03-consent.png");
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByText("GET /api/photos → 200").waitFor();
  await shot("lab03-spa-log.png");

  await browser.close();
  console.log(`Wrote 5 screenshots to ${out}`);
}

main().finally(() => children.forEach(killTree)).catch((e) => {
  console.error(e);
  process.exit(1);
});
