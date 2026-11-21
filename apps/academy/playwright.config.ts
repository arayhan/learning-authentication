import { defineConfig } from "@playwright/test";

// Labs run via the repo-root runner; reuseExistingServer lets a dev's own `pnpm dev` / `pnpm lab` be picked up.
const root = "../..";
const lab = (n: string, port: number) => ({
  command: `node scripts/lab.mjs ${n} --go`,
  cwd: root,
  url: `http://127.0.0.1:${port}/healthz`,
  reuseExistingServer: true,
  timeout: 180_000,
});

export default defineConfig({
  testDir: "./e2e",
  workers: 1, // specs share three lab servers and one database
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: [
    { command: "pnpm dev", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 120_000 },
    lab("01", 4101),
    lab("02", 4102),
    lab("03", 4103),
  ],
});
