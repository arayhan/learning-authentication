import assert from "node:assert/strict";
import { createServer } from "node:net";
import { test } from "node:test";
import { assertPortFree, isPortFree } from "./port.mjs";

const listen = (port = 0) =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(port, "127.0.0.1", () => resolve(s));
  });
const close = (s) => new Promise((r) => s.close(r));

test("isPortFree reports in-use while a server is bound, free once closed", async () => {
  const s = await listen();
  const { port } = s.address();
  assert.equal(await isPortFree(port), false);
  await assert.rejects(assertPortFree(port), new RegExp(`port ${port} already in use \\(is another lab running\\?\\)`));
  await close(s);
  assert.equal(await isPortFree(port), true);
  await assertPortFree(port);
});
