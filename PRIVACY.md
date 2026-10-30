# Privacy Policy

Kolo is an open-source tool for keeping the records of rotating savings groups. This policy describes what the software stores and shows. If you run your own instance, you are responsible for how you operate it and for complying with local law (for example, Nigeria's NDPA, Kenya's Data Protection Act, South Africa's POPIA, or the GDPR).

## What Kolo stores

| Data | Why | Who sees it |
|---|---|---|
| Organizer account (email, name) | Sign-in and ownership of circles | The organizer and people they share a circle with |
| Circle terms (name, amount, schedule, currency) | To run the circle | Organizer; members through their link |
| Member names | To match payments and show the rotation | Organizer; other members of the same circle |
| Member phone numbers | To prepare WhatsApp reminders | Organizer only, never on public pages |
| Bank-name aliases (for example "OKONKWO EMEKA J") | To match future alerts | Organizer only |
| Pasted bank alerts | Evidence behind each ledger entry | Organizer only |
| Ledger entries | The circle's financial record | Organizer; members through their link |
| Reminder log | To avoid over-reminding | Organizer only |

Kolo does **not** connect to bank accounts, store card or account credentials, or hold or move money.

## What members see

A member link (`/v/:token` or `/m/:token`) shows the circle name, member names, the ledger and balances. It never shows phone numbers, bank aliases, emails, raw alerts, or other members' links. These pages ask search engines not to index them.

## AI processing

When an organizer uses the Kolo agent, the relevant circle data and the organizer's message are sent to the language-model provider configured for that instance (for example Anthropic or OpenAI) to produce a response. Deterministic features (alert parsing, matching, rules, verification) run without any AI provider.

## Retention and deletion

Ledger entries are append-only by design, so the group's financial history can be audited. An organizer can delete a whole circle, which removes its members, alerts, reminders and ledger from the database. Hosted backups follow the operator's backup schedule.

## Cookies

Kolo uses only the cookies needed to keep an organizer signed in. Member pages need no cookies.

## Contact

Questions about this policy: open an issue on the repository. For security concerns, see [SECURITY.md](SECURITY.md).

_Last updated: 30 October 2026._
