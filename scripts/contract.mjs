// pnpm contract <01|02|03> <go|ts>: starts the lab, waits for /healthz, runs its contract test, stops the lab.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseContractArgs, resolveContract, resolveLab } from "./lab-config.mjs";
import { assertPortFree } from "./port.mjs";
import { killOnExit, killTree, spawnTree } from "./proc.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HEALTH_TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exited = (child) => child.exitCode !== null || child.signalCode !== null;

async function waitHealthy(url, server) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited(server)) throw new Error(`Lab exited before becoming healthy (code ${server.exitCode}).`);
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {
      // not listening yet
    }
    await sleep(250);
  }
  throw new Error(`${url} not healthy after ${HEALTH_TIMEOUT_MS / 1000}s.`);
}

const run = (r) =>
  new Promise((done) => {
    const child = spawnTree(r.command, r.args, { cwd: root, env: r.env });
    killOnExit([child]);
    child.on("error", (e) => (console.error(e.message), done(1)));
    child.on("exit", (code) => done(code ?? 1));
  });

let server;
let code = 1;
try {
  const { lab, impl } = parseContractArgs(process.argv.slice(2));
  const l = resolveLab(lab, impl, process.env);
  const c = resolveContract(lab, impl);
  for (const missing of [l.requires, c.requires].filter((p) => !existsSync(resolve(root, p)))) {
    throw new Error(`Lab ${lab} (${impl}) contract cannot run: ${missing} does not exist yet.`);
  }
  await assertPortFree(l.port);
  server = spawnTree(l.command, l.args, { cwd: root, env: l.env });
  killOnExit([server]);
  server.on("error", (e) => console.error(`Could not start "${l.command}": ${e.message}`));
  await waitHealthy(l.healthUrl, server);
  code = await run(c); // vitest's exit code is the script's exit code
} catch (e) {
  console.error(e.message);
} finally {
  if (server) killTree(server);
}
process.exit(code);
