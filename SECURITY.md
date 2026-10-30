# Security Policy

Kolo keeps financial records for savings groups, so we take integrity and privacy issues seriously.

## Supported versions

Only the latest release on the default branch receives security fixes.

## Reporting a vulnerability

**Please do not open a public issue.** Report privately through GitHub's **Security → Report a vulnerability** (private vulnerability reporting) on this repository.

Include:

- what the issue is and its impact (for example, "a member link exposes phone numbers"),
- steps to reproduce, with the affected route or action,
- any suggested fix.

We aim to acknowledge reports within 3 working days and to ship a fix or mitigation for confirmed high-severity issues within 14 days. We will credit reporters who want credit once a fix is released.

## In scope

- Altering, deleting, or reordering ledger entries without detection.
- Bypassing payout rules (`round_not_funded`, `out_of_order`, `wrong_recipient`, `amount_mismatch`, `overpayment`, `round_already_paid`, `terms_frozen`, `ledger_integrity`) through the UI, agent, MCP, CLI or HTTP.
- Reading or changing another organizer's circles.
- Personal data leaking through public pages (`/v/:token`, `/m/:token`, `/api/public/*`).
- Guessing or enumerating member tokens.
- Prompt injection that makes the agent take a money action the user did not ask for.

## Out of scope

- Real-world payment fraud. Kolo records payments; it does not move money and cannot confirm a transfer happened.
- Attacks that need the organizer's own signed-in device or credentials.
- `simulate-tamper`, which exists only in development to demonstrate detection.
- Denial-of-service through volume alone.

## How Kolo protects records

| Layer | Protection |
|---|---|
| Database | Trigger blocks `UPDATE`/`DELETE` on `ledger_entries`; unique `(circle_id, seq)` |
| Write path | `withCircleLock`: row lock → re-verify chain → rule check → append, in one transaction |
| Hash chain | SHA-256 over canonical JSON, each entry committing to the previous hash |
| Members | Browsers re-verify the whole chain; seals travel in WhatsApp reminders, so a rewritten chain stops matching |
| Access | Organizer data scoped by owner; public links are 128-bit random tokens, read-only, `noindex` |

Secrets (`BETTER_AUTH_SECRET`, `DATABASE_URL`, model API keys) belong in environment variables, never in the repository.
