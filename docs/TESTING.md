# Testing

<!-- tests:start -->
<!-- tests:end -->

These counts are written by `scripts/sync-test-badges.mjs` from the actual result files of the last `pnpm test:all` run. The README badges come from the same run, so the two always agree.

## Commands

| Command | What it runs |
|---|---|
| `pnpm test` | Unit tests (Vitest, `tests/`) |
| `pnpm test:e2e` | End-to-end tests (Playwright, `e2e/`) |
| `pnpm test:all` | Both, then updates the README badges and the counts above |
| `pnpm typecheck` | Strict TypeScript |

First time only: `npx playwright install chromium`, or set `E2E_CHANNEL=msedge` (or `chrome`) to use an installed browser.

## Unit tests (`tests/`, 5 files)

| File | Covers |
|---|---|
| `ledger.test.ts` | Canonical JSON, sealing, tamper detection (edits, deletions, insertions, reordering) |
| `circle-state.test.ts` | Ledger fold and every payout/contribution rule and refusal code |
| `alerts.test.ts` | GTBank, Access, OPay/Moniepoint, M-Pesa and Zelle alert formats; debits; splitting pasted threads |
| `matcher.test.ts` | Surname-first names, initials, honorifics, learned aliases, ambiguity |
| `schedule-money.test.ts` | Due dates across cadences and month ends; minor-unit money maths |

## End-to-end tests (`e2e/`)

Public pages run against the **production build** (what visitors get). Signed-in flows run against the **dev server**, which offers "Continue as local dev" sign-in. `playwright.config.ts` starts both if they aren't running.

| Spec | Project(s) | Covers |
|---|---|---|
| `landing.spec.ts` (6 tests) | desktop + mobile | Hero and CTAs; live matcher (debits skipped, duplicates refused, strangers unmatched); tamper demo (edit caught, rehash cover-up caught, restore); FAQ by keyboard; no horizontal scroll; no serious axe accessibility violations |
| `perf.spec.ts` (2 tests) | desktop | CLS < 0.1 and LCP budget on the landing page; public API response time |
| `app.spec.ts` (2 tests) | app | Sign in, seed a sample circle, payout locked in the UI **and** refused by the server (`round_not_funded`), inbox, in-browser ledger verification, circles list |
| `member.spec.ts` (1 test) | app | A signed-out member link re-verifies the ledger, is `noindex`, and bad tokens show a clear error |

Performance budgets are loose by default. Set `E2E_STRICT=1` to enforce production budgets (LCP < 2.5 s, public API < 200 ms).

## Reports

- `e2e/.report/html/index.html`: Playwright HTML report with traces for failures
- `e2e/.report/results.json`, `e2e/.report/unit.json`: machine-readable results used for the badges
