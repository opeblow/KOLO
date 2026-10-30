# Contributing to Kolo

Thanks for helping keep savings circles honest. This guide covers setup, the rules the code must keep, and what a pull request needs.

## Setup

Requires Node ≥ 22.22 and pnpm 10.

```bash
pnpm install
pnpm dev                       # http://localhost:8080, local PGlite database
npx playwright install chromium   # once, for end-to-end tests
```

Sign in with **Continue as local dev**, then **Explore a sample** to get a circle with history, late payers and alerts.

## Checks every pull request must pass

```bash
pnpm typecheck            # strict TypeScript
pnpm test                 # unit tests (Vitest)
pnpm test:e2e             # end-to-end tests (Playwright; starts or reuses the dev server)
pnpm agent-native:doctor  # framework guards
```

Update the test counts in `README.md` and `docs/TESTING.md` when you add or remove tests, so the badges and the docs always agree.

## Rules the code must keep

These protect members' money records. Pull requests that weaken them will not be merged.

1. **The ledger is the only source of truth.** Balances, schedules, lateness and exposure are computed by folding `ledger_entries` (`shared/circle-state.ts`). Never store a balance anywhere else.
2. **Append-only.** Never update or delete ledger rows. Corrections are `reversal` entries.
3. **Every write goes through `withCircleLock`**, which locks the circle row, re-verifies the hash chain, checks the rules, then appends.
4. **Money is integer minor units** (kobo, cents). Format only at the edge.
5. **Rules live in code, not prompts.** The agent calls the same actions as the UI; refusals (`round_not_funded`, `out_of_order`, …) must come from `shared/circle-state.ts`.
6. **Public pages expose no personal data**: no phone numbers, bank aliases, emails or other members' tokens.
7. **Shared code runs in the browser too.** Keep `shared/` free of Node-only APIs; use Web Crypto.

## Style

- Formatting: `oxfmt` (`.oxfmtrc.json`).
- UI: use the semantic tokens in `app/global.css` (`kolo-surface`, `kolo-kpi`, `--primary`, `--gold`, `--clay`). Respect `prefers-reduced-motion`. Give interactive elements an accessible name and a visible focus ring.
- Write plain-language user-facing copy. Refusal messages should say what's missing, for example "Round 5 is short ₦100,000. Waiting on Bisi, Musa."

## Pull requests

- One focused change per pull request, with a short description of what and why.
- Add or update tests for behaviour changes. Ledger and rules changes need unit tests in `tests/`; user-facing flows need a Playwright spec in `e2e/`.
- Include screenshots for UI changes (desktop and a 390 px phone width).

## Reporting bugs and security issues

Open a GitHub issue for bugs. For security issues, follow [SECURITY.md](SECURITY.md) and do not open a public issue.

By contributing you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md) and to license your work under the [MIT License](LICENSE).
