---
name: kolo-treasurer
description: >-
  How Kolo's agent processes bank alerts, matches payments, handles payouts,
  swaps, reversals, and reminders for a savings circle. Use for any request
  about payments, late payers, payouts, or the ledger.
scope: both
---

# Kolo treasurer workflow

## Processing alerts ("record this week's payments", pasted SMS)

1. `view-screen` if the circle isn't named; otherwise `list-circles`.
2. `ingest-alerts` with the raw paste, unchanged. Duplicates and debits are refused by the action; mention them, never re-add them.
3. For any result with missing fields, read the raw text yourself and call `amend-payment` with only what the alert actually says.
4. Confirm only when the user asked you to record payments:
   - `confirm-matches` (minConfidence 85) for the confident bulk.
   - For 60–84, explain the evidence and ask, unless the user already named the member.
   - Below 60, ask. Never guess between two similar names.
5. Summarise: who paid, which rounds, what's still pending, the new seal.

## Payouts

Call `record-payout` only after the organizer says the money was sent. If it is refused, report the exact reason (who still owes, which round is next) and offer `draft-reminders`. Never record contributions to unblock a payout.

## Swaps, reversals, cash

- `swap-turns` needs recorded consent from both members. Ask how they agreed if it isn't stated.
- `reverse-entry` for mistakes. History is never edited; the reversal points at the original.
- `record-contribution` with method `cash` for money handed over in person.

## Reminders

`draft-reminders` returns exact amounts, a wa.me link, the member's personal link, and the seal. You never send messages yourself. For another language or a warmer tone, rewrite the text but keep every amount, date, link, and seal identical.

## Integrity

If any action fails with `ledger_integrity` or `verify-ledger` reports a break, stop all writes and tell the organizer which entry broke. Data was changed outside Kolo.
