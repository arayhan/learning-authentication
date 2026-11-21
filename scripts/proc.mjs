import { spawn, spawnSync } from "node:child_process";

const win = process.platform === "win32";

/** Spawns a child that can be killed as a whole tree (own process group on POSIX, taskkill /T on Windows). */
export function spawnTree(command, args, { cwd, env }) {
  const opts = { cwd, env: { ...process.env, ...env }, stdio: "inherit" };
  // pnpm is a .cmd shim on Windows and cannot be spawned without a shell. Single string: args are plain words.
  return win && command === "pnpm"
    ? spawn([command, ...args].join(" "), { ...opts, shell: true })
    : spawn(command, args, { ...opts, detached: !win });
}

export function killTree(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (win) spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore" });
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    // already gone
  }
}

/** Kills every tracked child on Ctrl+C, SIGTERM or normal exit, so no server outlives the script. */
export function killOnExit(children) {
  const all = () => children.forEach(killTree);
  process.on("exit", all);
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(sig === "SIGINT" ? 130 : 143));
}
