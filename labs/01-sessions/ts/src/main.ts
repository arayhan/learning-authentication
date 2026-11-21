// Lab 01 (TS): passwords and cookie sessions. Contract: see labs/contract/lab01.test.ts.
import { serve } from "@hono/node-server";
import { createHub } from "@academy/trace";
import { readFileSync } from "node:fs";
import { createApp } from "./app.ts";
import { initDummyHash } from "./password.ts";
import { openStore } from "./store.ts";

await initDummyHash(); // throws (process exits) if hashing is broken
const port = Number(process.env.PORT || 4201);
const store = await openStore(process.env.DATABASE_URL || "postgres://academy:academy@localhost:5433/labs");
const ui = readFileSync(new URL("../../ui/index.html", import.meta.url), "utf8"); // shared with the Go lab
const app = createApp(store, ui, createHub(200));

// Loopback only: the vulnerable mode must never be reachable off-machine.
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => console.log(`lab01 (ts) listening on http://127.0.0.1:${port}`));
