// Lab 03 (TS): OAuth 2.0 authorization server + PKCE, a public SPA client and a resource API: three listeners,
// one process. Contract: see labs/contract/lab03.test.ts.
import { serve } from "@hono/node-server";
import { createHub } from "@academy/trace";
import { createApiApp } from "./api.ts";
import { createAsApp } from "./as.ts";
import { createClientApp } from "./pages.ts";
import { initDummyHash } from "./password.ts";
import { openStore } from "./store.ts";

await initDummyHash(); // throws (process exits) if hashing is broken
const asPort = Number(process.env.PORT || 4203);
const clientPort = Number(process.env.CLIENT_PORT || asPort + 10);
const apiPort = Number(process.env.API_PORT || asPort + 20);
const store = await openStore(process.env.DATABASE_URL || "postgres://academy:academy@localhost:5433/labs");
const hub = createHub(200); // one hub: all three listeners trace into it, /__trace is mounted on the AS only

// Loopback only: the vulnerable mode must never be reachable off-machine.
const listen = (name: string, port: number, app: { fetch: (r: Request) => Response | Promise<Response> }) =>
  serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => console.log(`lab03 (ts) ${name} listening on http://127.0.0.1:${port}`));

listen("client", clientPort, createClientApp(hub));
listen("api", apiPort, createApiApp(store, hub, `http://127.0.0.1:${asPort}`));
listen("as", asPort, createAsApp(store, hub)); // last: /healthz on the AS port means the other two are open
console.log(`lab03 (ts) kid ${store.keys.kid}`);
