#!/usr/bin/env node
/**
 * Production start for Render (and the CI boot test).
 * Applies SQL migrations, then listens on HOST:PORT with the Nitro node server.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.BETTER_AUTH_URL && process.env.RENDER_EXTERNAL_URL) {
  process.env.BETTER_AUTH_URL = process.env.RENDER_EXTERNAL_URL;
}
process.env.HOST = process.env.HOST || "0.0.0.0";
if (!process.env.TRUST_PROXY && process.env.RENDER === "true") {
  process.env.TRUST_PROXY = "1";
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", env: process.env });
    child.on("exit", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

const migrated = await run(process.execPath, ["scripts/migrate.mjs"]);
if (migrated !== 0) process.exit(migrated);

const server = spawn(process.execPath, [".output/server/index.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
