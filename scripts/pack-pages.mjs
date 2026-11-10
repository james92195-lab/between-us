import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "dist/pages-site");

function walk(dir, found) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) walk(path, found);
    else if (name.name === "index.html") found.push(dir);
  }
}

const found = [];
walk(join(root, "dist/pages"), found);
walk(join(root, "dist/client"), found);
walk(join(root, ".output"), found);
const source = found.sort((a, b) => a.length - b.length)[0];
if (!source) {
  console.error("GitHub Pages build did not emit index.html");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(source, out, { recursive: true });
const assets = join(out, "assets");
const css = existsSync(assets)
  ? readdirSync(assets).find((name) => name.startsWith("styles-") && name.endsWith(".css"))
  : undefined;
for (const file of ["index.html", "404.html"]) {
  const path = file === "404.html" ? join(out, "404.html") : join(out, "index.html");
  if (file === "404.html") cpSync(join(out, "index.html"), path);
  if (!css) continue;
  const html = readFileSync(path, "utf8").replace(
    /href="(\/between-us\/)?assets\/styles-[^"]+\.css"/g,
    `href="/between-us/assets/${css}"`,
  );
  writeFileSync(path, html);
}
writeFileSync(join(out, ".nojekyll"), "");
console.log(`Packed ${source} -> dist/pages-site`);
