// Adapts the SPA build output (dist/client) for GitHub Pages:
// - index.html  : entry document served at the base path
// - 404.html    : same shell, so refreshing/deep-linking any client route works
// - .nojekyll   : keep files/folders starting with "_" (e.g. _shell.html) served
import { copyFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const outDir = join(process.cwd(), "dist", "client");
const shell = join(outDir, "_shell.html");

await access(shell);
await copyFile(shell, join(outDir, "index.html"));
await copyFile(shell, join(outDir, "404.html"));
await writeFile(join(outDir, ".nojekyll"), "");

console.log("[gh-pages] index.html, 404.html and .nojekyll written to dist/client");
