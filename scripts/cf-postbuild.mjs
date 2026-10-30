#!/usr/bin/env node
/**
 * Cloudflare Workers post-build fix.
 *
 * The generated `.output/server/worker.mjs` imports
 * `@agent-native/core/db/request-pool-context` by package name, but the
 * Worker is uploaded with `no_bundle`, so Cloudflare can't resolve it
 * ("No such module"). This copies that self-contained helper next to the
 * Worker and rewrites the import to a relative path.
 *
 *   NITRO_PRESET=cloudflare_module pnpm build && node scripts/cf-postbuild.mjs
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const serverDir = path.resolve(".output/server");
const workerPath = path.join(serverDir, "worker.mjs");
const SPEC = "@agent-native/core/db/request-pool-context";
const LOCAL = "./_agent-native-request-pool-context.mjs";

if (!fs.existsSync(workerPath)) {
  console.error(`[cf-postbuild] ${workerPath} not found. Build with NITRO_PRESET=cloudflare_module first.`);
  process.exit(1);
}

const worker = fs.readFileSync(workerPath, "utf8");
if (worker.includes(`"${SPEC}"`)) {
  // The package's "exports" map allows this subpath, so resolve it directly.
  const require = createRequire(path.resolve("package.json"));
  fs.copyFileSync(require.resolve(SPEC), path.join(serverDir, LOCAL));
  fs.writeFileSync(workerPath, worker.split(`"${SPEC}"`).join(`"${LOCAL}"`));
  console.log(`[cf-postbuild] Inlined ${SPEC} as ${LOCAL}.`);
}

/*
 * Workers forbid generating code from strings, and Ajv (used by the MCP SDK to
 * check MCP tool *output* schemas) compiles every schema with `Function(...)`.
 * On Workers that throws EvalError and takes down every request. When code
 * generation is unavailable, fall back to a validator that accepts the value.
 * Action *inputs* are still validated by Zod, which has a no-eval path.
 */
const AJV_COMPILE =
  /let (\w+)=Function\(`\$\{(\w+)\.default\.self\}`,`\$\{\2\.default\.scope\}`,(\w+)\)\(this,this\.scope\.get\(\)\);/g;
const ajvFallback = (_m, v, r, g) =>
  `let ${v};try{${v}=Function(\`\${${r}.default.self}\`,\`\${${r}.default.scope}\`,${g})(this,this.scope.get())}` +
  `catch(__kolo_e){if(!(__kolo_e instanceof EvalError))throw __kolo_e;${v}=function(){return!0}}`;

let patchedFiles = 0;
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.m?js$/.test(entry.name)) {
      const src = fs.readFileSync(p, "utf8");
      if (!src.includes("ajv implementation error")) continue;
      const out = src.replace(AJV_COMPILE, ajvFallback);
      if (out !== src) {
        fs.writeFileSync(p, out);
        patchedFiles++;
      }
    }
  }
})(serverDir);
console.log(`[cf-postbuild] Ajv no-eval fallback applied in ${patchedFiles} file(s).`);
