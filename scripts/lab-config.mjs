// Pure helpers for scripts/lab.mjs and scripts/contract.mjs (no I/O, unit-tested in lab-config.test.mjs).

export const DEFAULT_DATABASE_URL = "postgres://academy:academy@localhost:5433/labs";

const LABS = {
  "01": { dir: "01-sessions", ports: { go: 4101, ts: 4201 } },
  "02": { dir: "02-jwt", ports: { go: 4102, ts: 4202 } },
  "03": { dir: "03-oauth-pkce", ports: { go: 4103, ts: 4203 } }, // AS port; client SPA and API sit on 41x3/42x3
};

const fail = (msg) => {
  throw new Error(msg);
};

export const labPort = (lab, impl) => LABS[lab]?.ports[impl] ?? fail(`Unknown lab "${lab}" or impl "${impl}"`);

/** `lab.mjs <01|02|03> [--go|--ts]` (default go). */
export function parseLabArgs(argv) {
  const usage = "Usage: pnpm lab <01|02|03> [--go|--ts]";
  const lab = argv.find((a) => !a.startsWith("--"));
  const flags = argv.filter((a) => a.startsWith("--"));
  const bad = flags.filter((f) => f !== "--go" && f !== "--ts");
  if (!lab || !LABS[lab] || bad.length || flags.length > 1 || argv.filter((a) => !a.startsWith("--")).length > 1) fail(usage);
  return { lab, impl: flags[0] === "--ts" ? "ts" : "go" };
}

/** `contract.mjs <NN> <go|ts>`. */
export function parseContractArgs(argv) {
  const [lab, impl, ...rest] = argv;
  if (!LABS[lab] || (impl !== "go" && impl !== "ts") || rest.length) fail("Usage: pnpm contract <01|02|03> <go|ts>");
  return { lab, impl };
}

/**
 * How to start one lab implementation. `requires` is the repo-relative path that must exist
 * (labs are built in later tasks, so callers report a clear "not found" instead of a spawn error).
 */
export function resolveLab(lab, impl, env = {}) {
  const { dir } = LABS[lab] ?? fail(`Unknown lab "${lab}"`);
  const port = labPort(lab, impl);
  const base = {
    requires: impl === "go" ? `labs/${dir}/go` : `labs/${dir}/ts/package.json`,
    env: { DATABASE_URL: env.DATABASE_URL || DEFAULT_DATABASE_URL },
    port,
    healthUrl: `http://127.0.0.1:${port}/healthz`,
  };
  return impl === "go"
    ? { ...base, command: "go", args: ["run", `./labs/${dir}/go`] }
    : { ...base, command: "pnpm", args: ["--filter", `@academy/lab${lab}-ts`, "dev"] };
}

/** How to run one lab's contract test against an already-running impl. */
export function resolveContract(lab, impl) {
  return {
    requires: "labs/contract/package.json",
    command: "pnpm",
    args: ["--filter", "@academy/lab-contract", "exec", "vitest", "run", `lab${lab}.test.ts`],
    env: { LAB_IMPL: impl, LAB_BASE_URL: `http://127.0.0.1:${labPort(lab, impl)}` },
  };
}
