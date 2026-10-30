#!/usr/bin/env node
/**
 * Writes the real test counts into README.md and docs/TESTING.md so the
 * badges and the docs always agree with the last run.
 *
 *   pnpm test:all   # runs unit + e2e, then this script
 *
 * Reads:  e2e/.report/unit.json (Vitest JSON) and e2e/.report/results.json (Playwright JSON)
 * Writes: the blocks between <!-- tests:start --> / <!-- tests:end --> markers.
 */
import fs from "node:fs";

const unit = JSON.parse(fs.readFileSync("e2e/.report/unit.json", "utf8"));
const e2e = JSON.parse(fs.readFileSync("e2e/.report/results.json", "utf8"));

const u = { passed: unit.numPassedTests, total: unit.numTotalTests, files: unit.numTotalTestSuites };
const s = e2e.stats;
const ePassed = s.expected;
const eFailed = s.unexpected;
const eFlaky = s.flaky;
const eSkipped = s.skipped;
const eTotal = ePassed + eFailed + eFlaky + eSkipped;
const date = new Date().toISOString().slice(0, 10);

const color = (ok) => (ok ? "brightgreen" : "red");
const badge = (label, passed, total) =>
  `![${label}: ${passed}/${total} passing](https://img.shields.io/badge/${encodeURIComponent(label)}-${passed}%2F${total}%20passing-${color(passed === total)})`;

const badges = [
  badge("unit tests", u.passed, u.total),
  badge("e2e tests", ePassed, eTotal),
  "![license: MIT](https://img.shields.io/badge/license-MIT-0E6B4A)",
  "![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6)",
  "![Node ≥ 22.22](https://img.shields.io/badge/node-%E2%89%A522.22-339933)",
].join("\n");

const summary = `**Last run ${date}: ${u.passed}/${u.total} unit tests and ${ePassed}/${eTotal} end-to-end tests passing** (${u.passed + ePassed}/${u.total + eTotal} total${eFlaky ? `, ${eFlaky} flaky` : ""}${eFailed ? `, ${eFailed} failing` : ""}).`;

function replaceBlock(file, name, body) {
  const text = fs.readFileSync(file, "utf8");
  const re = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(text)) throw new Error(`${file} is missing <!-- ${name}:start --> markers`);
  fs.writeFileSync(file, text.replace(re, `$1\n${body}\n$2`));
}

replaceBlock("README.md", "badges", badges);
replaceBlock("README.md", "tests", summary);
replaceBlock("docs/TESTING.md", "tests", summary);
console.log(summary);
