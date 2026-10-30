# Chat — Agent Guide

Chat is the minimal chat-first agent-native app. `/` redirects to shared sign-in, then `/home`, the editable Get started page. Chat lives at `/chat`; new chats start there. Actions carry capabilities; screens exist only for durable workflows.

## Skills

Search with `rg --hidden --follow`; read the exact linked guide before deeper work. `.agents/skills/build-an-app/SKILL.md` — start here for vague requests to create a domain app. `.agents/skills/adding-a-feature/SKILL.md` — cross-area feature checklist. Data/integrations: `.agents/skills/actions/SKILL.md`, `.agents/skills/storing-data/SKILL.md`, `.agents/skills/security/SKILL.md`, `.agents/skills/secrets/SKILL.md`, `.agents/skills/sharing/SKILL.md`. UI: `.agents/skills/frontend-design/SKILL.md`, `.agents/skills/shadcn-ui/SKILL.md`, `.agents/skills/client-side-routing/SKILL.md`. Agent context/workflows: `.agents/skills/context-awareness/SKILL.md`, `.agents/skills/real-time-sync/SKILL.md`, `.agents/skills/reliable-mutations/SKILL.md`, `.agents/skills/performance/SKILL.md`, `.agents/skills/delegate-to-agent/SKILL.md`. Framework: `.agents/skills/agent-native-docs/SKILL.md`, `.agents/skills/agent-native-toolkit/SKILL.md`, `.agents/skills/customizing-agent-native/SKILL.md`.

Use local docs only (no web research): `pnpm action docs-search --query "<topic>"`, `pnpm action docs-search --slug "<slug>"`, `pnpm action docs-search --list`, `pnpm action source-search --query "<pattern>"`, `pnpm action source-search --path <path>`, or `pnpm action source-search --list`. For external-agent integrations, read `pnpm action docs-search --slug "external-agents"`.

## Core rules

- UI feedback: target 100 ms, never exceed 400 ms; acknowledge before network work.
- Normal app data must flow through actions. Keep actions deterministic and focused; use agent chat/AgentSidebar for AI work and follow-ups in the same thread. Keep structured state in SQL and large files in configured storage; persist references only.
- For external integrations, inspect the workspace/provider connection catalog first; reuse its scoped resolver. Never hardcode credentials, webhook URLs, or private/customer data.
- Never fabricate. Report failures and recover; verify writes by reading the row or screen. Navigation is in `<current-screen>`; use `view-screen` for fresh visible-record details.

For custom branding, keep `server/plugins/agent-native-email-branding.ts` aligned: `app.name` appears in transactional email and optional `app.logoUrl` must be an absolute HTTPS URL.

## Application state

- `navigation` describes the view and selected ids. Chat is `chat` at `/chat` and `/chat/<threadId>`; the Get started page is `home` at `/home`; `/` opens shared sign-in/signup.
- Use `navigate` when supported and `view-screen` for a fresh read of visible details; basic navigation is already in `<current-screen>`.

## Building a domain app

Choose the primary workflow and route before editing. Add a domain route under `app/routes/` and set `app.homePath` in `server/plugins/agent-native-email-branding.ts` with `defineAppConfig`. The default Get started page lives at `/home`, and Chat stays at `/chat`; edit `app/routes/home.tsx` when replacing that page with a domain-specific home. Add a static link in `app/components/layout/Sidebar.tsx` before `ChatThreadsSection`; `Header.tsx` uses `APP_TITLE` elsewhere. Shared sidebar and AgentInspector remain.

Use `adding-a-feature` for functional parity and `frontend-design` for a user-facing screen. Keep feature guidance here; do not rewrite `README.md` or `DESIGN.md`. After all edits, run one typecheck, one doctor check, and one browser smoke of the primary workflow, including overlap rejection, cancellation freeing the slot, and authenticated landing. Skip production build and extra test suites.

Before building common workspace or agent UI, read `agent-native-toolkit`; for supported customization, read `customizing-agent-native`.

- Guarded verification: run `pnpm agent-native:doctor`; fix findings before done.

## Kolo — savings-circle treasurer

Kolo runs rotating savings circles (ajo, esusu, tanda, chama, susu). `/circles` lists them; `/circles/:id?tab=overview|inbox|ledger|members|settings` is one circle; `/` is the public landing page; `/v/:token` and `/m/:token` are public, read-only member pages that re-verify the ledger in the browser.

- Money lives only in `ledger_entries`: append-only (a DB trigger blocks UPDATE/DELETE) and SHA-256 hash-chained per circle. Balances are a fold over the ledger (`shared/circle-state.ts`); never compute or store them elsewhere.
- Every write goes through `withCircleLock` (row lock + chain re-verification). Rules live in `shared/circle-state.ts` and run on the server; refusals are 409s with codes `round_not_funded`, `out_of_order`, `wrong_recipient`, `amount_mismatch`, `overpayment`, `round_already_paid`, `terms_frozen`, `ledger_integrity`. Report them plainly; never work around one by inventing contributions or consent.
- Inputs take major units (50000 = ₦50,000); results return integer minor units. Due dates are calendar dates `YYYY-MM-DD`.
- `navigation` adds `circleId` and `tab` on circle pages.
- Workflow skill: `.agents/skills/kolo-treasurer/SKILL.md`.

| Action | Purpose |
|---|---|
| list-circles / get-circle | Circles and full derived state |
| create-circle / update-circle / upsert-member / set-payout-order / activate-circle | Draft setup, then seal terms |
| ingest-alerts / amend-payment / list-payment-inbox | Pasted bank alerts → matched inbox |
| confirm-payment / confirm-matches / reject-payment | Inbox → ledger |
| record-contribution / record-payout / swap-turns / reverse-entry / close-circle | Guarded ledger writes |
| draft-reminders / log-nudge | WhatsApp reminders (organizer sends) |
| list-ledger / verify-ledger | Audit and integrity |
