<p align="center">
  <img src="docs/logo.svg" alt="Kolo logo" width="96" height="96" />
</p>

<h1 align="center">Kolo</h1>

<p align="center"><b>Savings circles, kept honest.</b><br/>An AI treasurer for ajo, esusu, susu, chama, stokvel and tanda groups, with a ledger every member can verify on their own phone.</p>

<p align="center">
<a href="https://github.com/opeblow/KOLO/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/opeblow/KOLO/actions/workflows/ci.yml/badge.svg" /></a>
<a href="https://github.com/opeblow/KOLO/actions/workflows/codeql.yml"><img alt="CodeQL" src="https://github.com/opeblow/KOLO/actions/workflows/codeql.yml/badge.svg" /></a>
</p>

<p align="center">
<!-- badges:start -->
<!-- badges:end -->
</p>

<p align="center">
<a href="#screenshots">Screenshots</a> ·
<a href="#run-it">Run it</a> ·
<a href="docs/ARCHITECTURE.md">System design</a> ·
<a href="docs/TESTING.md">Testing</a> ·
<a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center"><img src="docs/screenshots/landing-hero.jpg" alt="Kolo landing page: 'Your ajo, kept honest.' beside a live savings-circle dashboard" width="900" /></p>

Organizers paste bank alerts. Kolo's agent matches every payment to a member and explains why, chases late payers through WhatsApp, and keeps a SHA-256 hash-chained ledger that members verify in their own browser, without trusting the organizer or Kolo's servers.

> Kolo keeps records. It never holds or moves money.

Built on [Agent-Native](https://agent-native.com) for the Builder.io Agent-Native Hackathon.

## Table of contents

- [Screenshots](#screenshots)
- [The problem](#the-problem)
- [What Kolo does](#what-kolo-does)
- [The hard part, made visible](#the-hard-part-made-visible)
- [Architecture](#architecture)
  - [Data model](#data-model)
- [Project structure](#project-structure)
- [Run it](#run-it)
  - [Deploy](#deploy)
- [Tests](#tests)
- [Continuous integration](#continuous-integration)
- [Limitations](#limitations)
- [Project](#project)

## Screenshots

| | |
|---|---|
| <img src="docs/screenshots/landing-demo.jpg" alt="Live alert matcher" /> | <img src="docs/screenshots/landing-tamper.jpg" alt="Tamper demo" /> |
| **Live matcher.** Paste real bank SMS on the landing page; the same parser and name matcher the app uses run in the visitor's browser and show their reasoning. | **Try to cook the books.** A real SHA-256 ledger built in the browser. Cut an amount and the chain breaks; rehash to cover it up and the members' seal stops matching. |
| <img src="docs/screenshots/app-circles.jpg" alt="Circles list" /> | <img src="docs/screenshots/app-overview.jpg" alt="Circle overview" /> |
| **Treasury.** Every circle at a glance: late payments, alerts waiting, and a progress ring for the current pot. | **Circle overview.** The rotation ring, who has paid this round, and a payout button that stays locked until the round is fully funded. |
| <img src="docs/screenshots/app-inbox.jpg" alt="Payment inbox" /> | <img src="docs/screenshots/app-ledger.jpg" alt="Ledger" /> |
| **Payment inbox.** Pasted alerts become proposals with a confidence score and the evidence behind it. Confirm in one tap. | **Hash-chained ledger.** Append-only entries, each sealed to the one before. Verify the whole chain in the browser. |
| <img src="docs/screenshots/app-members.jpg" alt="Members" /> | <img src="docs/screenshots/app-new.jpg" alt="New circle" /> |
| **Members.** Payout order, what each member has paid and still owes, and their private verification link. | **New circle.** Terms and payout order in one form, or paste the group's rules from WhatsApp and let the agent draft it. |

<p align="center"><img src="docs/screenshots/landing-features.jpg" alt="Feature grid: rules the AI can't bend, WhatsApp reminders, trust exposure" width="900" /></p>

## The problem

Friends pool a fixed amount every week or month and take turns collecting the whole pot. These groups run on WhatsApp and trust, and they break in three places:

1. **Reconciliation.** The organizer matches dozens of bank SMS ("TRANSFER FROM ADEBAYO TUNDE O") to members from memory.
2. **Chasing.** Reminders feel personal, so they go out late; the round stalls.
3. **Default after payout.** Once someone has collected, the group carries the risk, and nobody can see how much.

## What Kolo does

| Capability | Where the AI helps | Where code decides |
|---|---|---|
| Paste a night's worth of alerts | Agent reads formats the parser can't and fixes misread fields | Deterministic parser for GTBank/Access/OPay/Moniepoint/M-Pesa/Zelle formats; duplicate alerts and bank references refused; debits skipped |
| Match payments to members | Agent explains uncertain matches, asks before guessing | Scored name matching (surname-first, initials, honorifics, learned bank aliases) + amount fit; split across rounds |
| Pay out the pot | Agent explains *why* a payout is blocked and offers reminders | Rules engine in a locked DB transaction: in order, fully funded, right recipient, exact pot |
| Reminders | Agent rewrites tone or language | Templates with exact ledger amounts, `wa.me` links, member link, current seal |
| Trust | — | Append-only, SHA-256 hash-chained ledger; DB trigger blocks UPDATE/DELETE; members' browsers re-verify every hash |

## The hard part, made visible

1. **The AI can't bend the money rules.** Ask the agent to "pay Emeka now" while two members haven't paid. `record-payout` refuses inside the transaction with `round_not_funded: Round 5 is short ₦100,000. Waiting on Bisi, Musa.`, and the agent relays it and offers reminders.
2. **Tampering is detectable by anyone.** In development, *Ledger → Simulate tampering* plays a dishonest DB admin: it disables the trigger and cuts one recorded amount. The circle page turns red, new writes are blocked (`ledger_integrity`), and the public member page says *"Entry #2 was changed after it was recorded."*
3. **Same action, every surface.** Each ledger entry records whether it came from the app, the agent, MCP, the CLI, or a scheduled job.

## Architecture

```mermaid
flowchart LR
  subgraph Surfaces
    UI[React UI<br/>useActionQuery / useActionMutation]
    AG[Kolo agent<br/>AGENTS.md + kolo-treasurer skill]
    MCP[MCP clients / CLI / A2A]
    PUB[Public member pages<br/>/v/:token  /m/:token]
  end
  subgraph Actions["actions/*.ts — defineAction (one contract)"]
    ING[ingest-alerts · amend-payment]
    CONF[confirm-payment · confirm-matches]
    PAY[record-payout · record-contribution · swap-turns · reverse-entry]
    READ[get-circle · list-ledger · verify-ledger · draft-reminders]
  end
  subgraph Core["shared/ (runs on server AND in the browser)"]
    LED[ledger.ts<br/>canonical JSON + SHA-256 chain]
    ST[circle-state.ts<br/>fold + rules engine]
    PAR[alerts.ts · matcher.ts]
  end
  DB[(Postgres / PGlite<br/>ledger_entries: append-only trigger)]
  UI --> Actions
  AG --> Actions
  MCP --> Actions
  Actions -->|withCircleLock: row lock → re-verify chain → fold → rule check → append| DB
  Actions --> Core
  PUB -->|/api/public read-only JSON| DB
  PUB -->|verifyChain + foldLedger in browser| Core
```

**Key design decisions**

- **Ledger as the single source of truth.** Balances, schedule, who's late and trust exposure are a pure fold over the ledger (`shared/circle-state.ts`). Nothing about money is stored anywhere else, so nothing can drift.
- **Integer minor units** everywhere; formatting only at the edge.
- **Per-circle serialization.** `withCircleLock` takes `SELECT … FOR UPDATE` on the circle row, re-reads and re-verifies the chain, then appends. Circles proceed in parallel; writers to one circle serialize. A broken chain blocks writes rather than burying the evidence.
- **Defence in depth.** Server rules, a database trigger, a unique `(circle_id, seq)` constraint, and client-side verification.
- **AI through the agent only.** Actions are deterministic; AI work goes through the agent chat (`sendToAgentChat`), per Agent-Native's rules.
- **Members need no account.** 128-bit tokens, read-only routes, no phones/aliases/emails exposed, `noindex`.

### Data model

| Table | Purpose |
|---|---|
| `circles` | Terms (editable only in draft), status, public token, cached chain head. Ownable/shareable via Agent-Native sharing |
| `circle_members` | Profile only: name, phone, learned bank aliases, personal token |
| `ledger_entries` | `seq`, `kind`, canonical `payload`, `prev_hash`, `hash`, `recorded_via`. Append-only trigger |
| `payment_signals` | Inbox: raw alert, parsed fields, fingerprint (unique per circle), proposal + confidence |
| `nudges` | Reminders actually sent |

## Project structure

```text
kolo/
├── actions/                  # One typed action per capability, shared by UI, agent, MCP and CLI
│   ├── ingest-alerts.ts      #   pasted bank alerts → parsed, de-duplicated inbox
│   ├── confirm-payment.ts    #   inbox → ledger (rules checked under lock)
│   ├── record-payout.ts      #   guarded payout: in order, fully funded, right recipient
│   ├── verify-ledger.ts      #   recompute the whole hash chain
│   └── …                     #   30 action files in total
├── app/                      # React Router 8 front end (SSR)
│   ├── routes/               #   /, /circles, /circles/:id, /v/:token, /m/:token
│   ├── components/
│   │   ├── landing/          #   landing page and live demos
│   │   ├── circle/           #   overview, inbox, ledger, members, settings tabs
│   │   ├── public/           #   member verification page
│   │   └── kolo/             #   brand mark, seal, rotation ring
│   └── global.css            #   design tokens (light and dark)
├── shared/                   # Pure core that runs on the server and in the browser
│   ├── ledger.ts             #   canonical JSON + SHA-256 chain + verifyChain
│   ├── circle-state.ts       #   ledger fold and the rules engine
│   ├── alerts.ts             #   bank-alert parser (GTBank, Access, OPay, M-Pesa, Zelle…)
│   ├── matcher.ts            #   sender-name → member matching with reasons
│   ├── money.ts              #   integer minor units and formatting
│   └── schedule.ts           #   due dates per cadence
├── server/                   # Nitro server
│   ├── db/                   #   Drizzle schema (append-only ledger trigger)
│   ├── lib/                  #   withCircleLock, public view, reminders
│   └── routes/api/public/    #   read-only member JSON
├── tests/                    # Unit tests (Vitest)
├── e2e/                      # End-to-end tests (Playwright)
├── scripts/                  # test runner and badge sync
├── docs/                     # architecture, testing, logo, screenshots
├── .github/                  # CI, CodeQL, Dependabot, templates
└── AGENTS.md                 # Agent guide and action catalogue
```

## Run it

Requires Node ≥ 22.22 and pnpm.

```bash
pnpm install
pnpm dev            # http://localhost:8080 — local PGlite DB, migrations run on boot
```

Sign in with **Continue as local dev**, then **Explore a sample** to get a circle with four weeks of history, two late payers, and alerts in the inbox. Add an LLM key (Anthropic/OpenAI) in Settings → Agent, or `.env`, to talk to the agent.

The same actions from the terminal (while `pnpm dev` runs):

```bash
pnpm action list-circles
pnpm action record-payout --circleId <id> --round 4      # refused: round_not_funded
pnpm action verify-ledger --circleId <id>
```

### Deploy

Any Nitro target. Set `DATABASE_URL` (Postgres: Neon, Supabase, RDS) and `BETTER_AUTH_SECRET`, run `pnpm migrate:production`, then `pnpm build`.

## Tests

<!-- tests:start -->
<!-- tests:end -->

```bash
pnpm test         # unit tests (Vitest): ledger tamper detection, payout rules, parser formats, matcher, schedule, money
pnpm test:e2e     # end-to-end tests (Playwright): landing demos, organizer workflow, member verification, accessibility, performance
pnpm test:all     # both, then writes the counts above and the badges from the actual results
pnpm typecheck    # strict: noUncheckedIndexedAccess + exactOptionalPropertyTypes
```

What each suite covers, and how to run it, is in [docs/TESTING.md](docs/TESTING.md). System design and latency budgets are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Continuous integration

Every push and pull request runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

| Job | Runs |
|---|---|
| Typecheck, guards and unit tests | `pnpm typecheck`, `pnpm agent-native:doctor`, `pnpm test` |
| Production build | `pnpm build`, uploaded as an artifact |
| End-to-end tests | Playwright against the production build and dev server; HTML report uploaded as an artifact |

[CodeQL](.github/workflows/codeql.yml) scans the code weekly and on every pull request. Dependabot keeps npm packages and Actions current.

## Limitations

- Kolo records money; it does not move it. Payouts are recorded after the organizer transfers.
- Bank-alert parsing covers common formats; others go through the agent (`amend-payment`), and anything unreadable stays in the inbox for a person.
- Verification proves the ledger wasn't altered *after* entries were recorded; it can't prove a recorded payment happened in the real world. That's why every entry links to its source alert and members hold the seal from reminders.
- Seal anchoring is social (seals travel in WhatsApp reminders); there is no external timestamping service yet.
- Reminder templates: English, Nigerian Pidgin, French, Spanish, Swahili. Other languages come from the agent.
- WhatsApp sending is user-initiated via `wa.me` links, with no WhatsApp Business API integration.

## Project

- [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [Privacy](PRIVACY.md)
- Licensed under the [MIT License](LICENSE).
