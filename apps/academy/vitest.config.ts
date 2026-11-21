import path from "node:path";
import { defineConfig } from "vitest/config";

const TEST_DB = "postgres://academy:academy@localhost:5433/academy_test";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    env: { DATABASE_URL: TEST_DB },
    globalSetup: ["./vitest.global-setup.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    fileParallelism: false,
  },
});
