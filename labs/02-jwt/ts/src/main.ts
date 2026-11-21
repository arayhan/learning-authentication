// Lab 02 (TS): JWT access tokens, JWKS, rotating refresh tokens. Contract: see labs/contract/lab02.test.ts.
import { serve } from "@hono/node-server";
import { createHub } from "@academy/trace";
import { createApp } from "./app.ts";
import { initDummyHash } from "./password.ts";
import { openStore } from "./store.ts";

await initDummyHash(); // throws (process exits) if hashing is broken
const port = Number(process.env.PORT || 4202);
const store = await openStore(process.env.DATABASE_URL || "postgres://academy:academy@localhost:5433/labs");
const app = createApp(store, createHub(200));

// Loopback only: the vulnerable mode must never be reachable off-machine.
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => console.log(`lab02 (ts) listening on http://127.0.0.1:${port} (kid ${store.keys.kid})`));
