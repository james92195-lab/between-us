#!/usr/bin/env node
/**
 * The Render Nitro preset listens with srvx and does not pass `trustProxy`,
 * so X-Forwarded-Proto is ignored. Patch the built node entry to trust it.
 * Fails the build if the serve() call is not the shape this expects.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const needle = "serve({\n\tport,\n\thostname: host,";
const patched = "serve({\n\tport,\n\thostname: host,\n\ttrustProxy: true,";

export function enableTrustProxy(source) {
  if (source.includes(patched)) return source;
  if (!source.includes(needle)) {
    throw new Error("Nitro node server entry has no serve({ port, hostname }) call to mark trustProxy");
  }
  return source.replace(needle, patched);
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invoked === import.meta.url) {
  const file = join(dirname(fileURLToPath(import.meta.url)), "..", ".output", "server", "index.mjs");
  const next = enableTrustProxy(readFileSync(file, "utf8"));
  writeFileSync(file, next);
  if (!next.includes("trustProxy: true")) {
    throw new Error("trustProxy was not written into the server entry");
  }
  console.log("[render] trustProxy enabled on the node server");
}
