import { createServer } from "node:net";

/** True when nothing is bound to host:port (labs bind 127.0.0.1). Other listen errors are rethrown. */
export const isPortFree = (port, host = "127.0.0.1") =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", (e) => (e.code === "EADDRINUSE" || e.code === "EACCES" ? resolve(false) : reject(e)));
    s.listen(port, host, () => s.close(() => resolve(true)));
  });

/** Fail fast so a stale server cannot answer a lab's health check or contract run. */
export async function assertPortFree(port) {
  if (!(await isPortFree(port))) throw new Error(`port ${port} already in use (is another lab running?)`);
}
