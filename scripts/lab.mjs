// pnpm lab <01|02|03> [--go|--ts]: runs one lab implementation in the foreground.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLabArgs, resolveLab } from "./lab-config.mjs";
import { killOnExit, spawnTree } from "./proc.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const { lab, impl } = parseLabArgs(process.argv.slice(2));
  const r = resolveLab(lab, impl, process.env);
  if (!existsSync(resolve(root, r.requires))) {
    throw new Error(`Lab ${lab} (${impl}) not found: ${r.requires} does not exist yet.`);
  }
  console.log(`Starting lab ${lab} (${impl}) on http://127.0.0.1:${r.port}`);
  const child = spawnTree(r.command, r.args, { cwd: root, env: r.env });
  killOnExit([child]);
  child.on("error", (e) => {
    console.error(`Could not start "${r.command}": ${e.message}`);
    process.exit(1);
  });
  child.on("exit", (code) => process.exit(code ?? 1));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
