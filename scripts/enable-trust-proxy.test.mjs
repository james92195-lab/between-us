import assert from "node:assert/strict";
import test from "node:test";
import { enableTrustProxy } from "./enable-trust-proxy.mjs";

const stock = `serve({
	port,
	hostname: host,
	fetch: app.fetch
});`;

test("enableTrustProxy marks the node serve() call", () => {
  const next = enableTrustProxy(stock);
  assert.match(next, /trustProxy: true/);
  assert.equal(enableTrustProxy(next), next);
});

test("enableTrustProxy refuses an unknown server entry", () => {
  assert.throws(() => enableTrustProxy("serve({});"), /trustProxy/);
});
