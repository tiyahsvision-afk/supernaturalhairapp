// Builds a self-contained static copy of ROBOREALM in ./static-dist: one index.html
// (all screens routed by URL hash) plus relative _next/, pyodide/ and a trimmed monaco/.
// The optional NOVA chat route needs a server, so it is left out of this build.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = join(root, "src/app/api");
const parked = join(root, ".api-parked");
const out = join(root, "out");
const dist = join(root, "static-dist");

renameSync(api, parked);
try {
  execSync("npx next build", { cwd: root, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_STATIC: "1", NEXT_TELEMETRY_DISABLED: "1" } });
} finally {
  renameSync(parked, api);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
cpSync(join(out, "_next"), join(dist, "_next"), { recursive: true });
cpSync(join(root, "public/pyodide"), join(dist, "pyodide"), { recursive: true });
// Static hosts that refuse .zip get the Python stdlib as base64 text (decoded in py.worker.ts).
writeFileSync(join(dist, "pyodide/python_stdlib.b64.txt"), readFileSync(join(dist, "pyodide/python_stdlib.zip")).toString("base64"));
rmSync(join(dist, "pyodide/python_stdlib.zip"));
for (const f of ["loader.js", "editor", "base", "basic-languages/python", "basic-languages/_.contribution.js"]) {
  const src = join(root, "public/monaco/vs", f);
  if (existsSync(src)) cpSync(src, join(dist, "monaco/vs", f), { recursive: true });
}

// The build used the placeholder prefix /__RR__; rewrite it so every URL is relative
// to wherever index.html is hosted. All chunks sit three levels down (_next/static/<kind>/),
// which lets scripts and workers find the base from their own location.
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const BASE_EXPR =
  '(typeof document!=="undefined"?new URL("./",document.baseURI).href:new URL("../../../",self.location.href).href)';
for (const f of walk(join(dist, "_next"))) {
  if (f.endsWith(".css")) {
    writeFileSync(f, readFileSync(f, "utf8").replaceAll("/__RR__/_next/static/media/", "../media/"));
  } else if (f.endsWith(".js")) {
    const src = readFileSync(f, "utf8");
    if (!src.includes("/__RR__")) continue;
    writeFileSync(
      f,
      src
        .replaceAll('"/__RR__/_next/"', `${BASE_EXPR}+"_next/"`)
        .replaceAll('"/__RR__"', `${BASE_EXPR}.slice(0,-1)`),
    );
  }
}
const html = readFileSync(join(out, "index.html"), "utf8").replaceAll("/__RR__/_next/", "./_next/").replaceAll("/__RR__", ".");
writeFileSync(join(dist, "index.html"), html);
// The artifact host reserves top-level names starting with "_", so serve Next's assets from rr/.
renameSync(join(dist, "_next"), join(dist, "rr"));
for (const f of walk(dist).filter((f) => /\.(js|css|html)$/.test(f) && !f.includes("/pyodide/") && !f.includes("/monaco/"))) {
  const src = readFileSync(f, "utf8");
  if (src.includes("_next/")) writeFileSync(f, src.replaceAll("_next/", "rr/"));
}
// The host rejects literal U+FFFD characters; in Next's polyfills they only occur inside string literals.
for (const f of walk(join(dist, "rr")).filter((f) => f.endsWith(".js"))) {
  const src = readFileSync(f, "utf8");
  if (src.includes("\uFFFD")) writeFileSync(f, src.replaceAll("\uFFFD", "\\uFFFD"));
}
const left = walk(dist).filter((f) => /\.(js|css|html)$/.test(f) && readFileSync(f, "utf8").includes("__RR__"));
if (left.length) console.warn("placeholder still present in:", left);
console.log(`static build ready: ${walk(dist).length} files in static-dist/`);
