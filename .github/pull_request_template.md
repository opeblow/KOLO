## What and why

<!-- One or two sentences. Link the issue if there is one. -->

## Checklist

- [ ] `pnpm typecheck` and `pnpm test` pass
- [ ] `pnpm test:e2e` passes, or I explained why it can't run
- [ ] Ledger stays append-only; every money write goes through `withCircleLock`
- [ ] No personal data added to public pages (`/v/:token`, `/m/:token`, `/api/public/*`)
- [ ] Screenshots attached for UI changes (desktop and 390 px phone width)
