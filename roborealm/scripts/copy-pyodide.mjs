// Self-host the Pyodide runtime so student Python runs without a third-party CDN.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pyodide");
const dest = join(root, "public", "pyodide");
if (!existsSync(src)) {
  console.warn("[copy-pyodide] pyodide package not installed; skipping");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const f of ["pyodide.mjs", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  cpSync(join(src, f), join(dest, f));
}
console.log("[copy-pyodide] copied runtime to public/pyodide");
