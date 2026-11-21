import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_DATABASE_URL, labPort, parseContractArgs, parseLabArgs, resolveContract, resolveLab } from "./lab-config.mjs";

test("ports match the project table", () => {
  assert.deepEqual(
    ["01", "02", "03"].map((l) => [labPort(l, "go"), labPort(l, "ts")]),
    [[4101, 4201], [4102, 4202], [4103, 4203]],
  );
  assert.throws(() => labPort("04", "go"));
});

test("parseLabArgs defaults to go and accepts --ts", () => {
  assert.deepEqual(parseLabArgs(["01"]), { lab: "01", impl: "go" });
  assert.deepEqual(parseLabArgs(["02", "--ts"]), { lab: "02", impl: "ts" });
  assert.deepEqual(parseLabArgs(["--go", "03"]), { lab: "03", impl: "go" });
});

test("parseLabArgs rejects bad input with usage", () => {
  for (const argv of [[], ["04"], ["01", "--rust"], ["01", "--go", "--ts"], ["01", "02"]]) {
    assert.throws(() => parseLabArgs(argv), /Usage: pnpm lab/, JSON.stringify(argv));
  }
});

test("parseContractArgs needs lab and impl", () => {
  assert.deepEqual(parseContractArgs(["01", "ts"]), { lab: "01", impl: "ts" });
  for (const argv of [[], ["01"], ["01", "rust"], ["09", "go"], ["01", "go", "x"]]) {
    assert.throws(() => parseContractArgs(argv), /Usage: pnpm contract/);
  }
});

test("resolveLab go", () => {
  const r = resolveLab("01", "go");
  assert.equal(r.command, "go");
  assert.deepEqual(r.args, ["run", "./labs/01-sessions/go"]);
  assert.equal(r.requires, "labs/01-sessions/go");
  assert.equal(r.healthUrl, "http://127.0.0.1:4101/healthz");
});

test("resolveLab ts", () => {
  const r = resolveLab("02", "ts");
  assert.equal(r.command, "pnpm");
  assert.deepEqual(r.args, ["--filter", "@academy/lab02-ts", "dev"]);
  assert.equal(r.requires, "labs/02-jwt/ts/package.json");
  assert.equal(r.healthUrl, "http://127.0.0.1:4202/healthz");
});

test("lab03 health check uses the AS port", () => {
  assert.equal(resolveLab("03", "go").healthUrl, "http://127.0.0.1:4103/healthz");
  assert.equal(resolveLab("03", "ts").healthUrl, "http://127.0.0.1:4203/healthz");
  assert.deepEqual(resolveLab("03", "go").args, ["run", "./labs/03-oauth-pkce/go"]);
});

test("DATABASE_URL defaults to the labs db but honours the environment", () => {
  assert.equal(resolveLab("01", "go").env.DATABASE_URL, DEFAULT_DATABASE_URL);
  assert.equal(DEFAULT_DATABASE_URL, "postgres://academy:academy@localhost:5433/labs");
  assert.equal(resolveLab("01", "go", { DATABASE_URL: "postgres://x/y" }).env.DATABASE_URL, "postgres://x/y");
  assert.equal(resolveLab("01", "go", { DATABASE_URL: "" }).env.DATABASE_URL, DEFAULT_DATABASE_URL);
});

test("resolveContract sets LAB_IMPL and LAB_BASE_URL for the chosen impl", () => {
  const r = resolveContract("03", "ts");
  assert.deepEqual(r.env, { LAB_IMPL: "ts", LAB_BASE_URL: "http://127.0.0.1:4203" });
  assert.deepEqual(r.args, ["--filter", "@academy/lab-contract", "exec", "vitest", "run", "lab03.test.ts"]);
  assert.equal(r.requires, "labs/contract/package.json");
});
