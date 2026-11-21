import assert from "node:assert/strict";
import { test } from "node:test";
import { killTree, spawnTree } from "./proc.mjs";

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code !== "ESRCH";
  }
};

async function waitGone(pids, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end && pids.some(alive)) await new Promise((r) => setTimeout(r, 50));
  return pids.filter(alive);
}

// Runs on the current platform only: taskkill /T on Windows, process-group kill elsewhere.
// The POSIX branch is not exercised when this suite runs on Windows.
test("killTree kills the child and its grandchild", async () => {
  const code = `
    const { spawn } = require("node:child_process");
    const g = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    console.log(g.pid);
    setInterval(() => {}, 1000);
  `;
  const child = spawnTree(process.execPath, ["-e", code], { cwd: process.cwd(), env: {}, stdio: ["ignore", "pipe", "inherit"] });
  const grandchild = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.stdout.once("data", (d) => resolve(Number(String(d).trim())));
  });
  assert.ok(Number.isInteger(grandchild) && grandchild > 0);
  assert.ok(alive(child.pid) && alive(grandchild));
  try {
    killTree(child);
  } finally {
    await waitGone([child.pid, grandchild]);
  }
  assert.deepEqual(await waitGone([child.pid, grandchild]), []);
});
