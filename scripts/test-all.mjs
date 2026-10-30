#!/usr/bin/env node
/**
 * Runs unit tests, then end-to-end tests, then writes the real counts into
 * README.md and docs/TESTING.md. Badges update even when tests fail, so the
 * README never claims more than the last run proved. Exits non-zero on failure.
 */
import { spawnSync } from "node:child_process";

const run = (cmd, args) => spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" }).status ?? 1;

const unit = run("npx", ["vitest", "--run", "--reporter=default", "--reporter=json", "--outputFile=e2e/.report/unit.json"]);
const e2e = run("npx", ["playwright", "test"]);
const sync = run("node", ["scripts/sync-test-badges.mjs"]);
process.exit(unit || e2e || sync);
