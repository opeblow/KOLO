/**
 * Deterministic bank-alert parser. Handles the formats organizers actually
 * paste: Nigerian bank SMS (GTBank, Access, Zenith, UBA style), OPay /
 * Moniepoint / Kuda notifications, M-Pesa confirmations, and Zelle / Cash App
 * receipts. Whatever this cannot read confidently, the agent reads instead and
 * passes structured fields back through the same `ingest-alerts` action.
 */
import type { CurrencyCode } from "./money";
import { CURRENCIES, toMinor } from "./money";

export interface ParsedAlert {
  raw: string;
  direction: "credit" | "debit" | "unknown";
  amountMinor: number | null;
  currency: CurrencyCode | null;
  senderName: string | null;
  /** Calendar date YYYY-MM-DD, or null when absent/unreadable. */
  occurredOn: string | null;
  reference: string | null;
  /** Fields the parser could not fill. */
  missing: ("amount" | "sender" | "date")[];
}

const CURRENCY_TOKENS: [RegExp, CurrencyCode][] = [
  [/^(?:NGN|₦|N)$/i, "NGN"],
  [/^(?:KES|KSH|KSh)$/i, "KES"],
  [/^(?:GHS|GH₵|GHC|₵)$/i, "GHS"],
  [/^(?:USD|\$|US\$)$/i, "USD"],
  [/^(?:GBP|£)$/i, "GBP"],
  [/^(?:EUR|€)$/i, "EUR"],
  [/^(?:ZAR|R)$/, "ZAR"],
  [/^(?:INR|₹|RS\.?)$/i, "INR"],
  [/^(?:PHP|₱)$/i, "PHP"],
  [/^(?:MXN|MX\$)$/i, "MXN"],
  [/^(?:XOF|CFA|FCFA)$/i, "XOF"],
];

const AMOUNT_RE =
  /(NGN|₦|KES|KSh|Ksh|GHS|GH₵|GHC|₵|USD|US\$|\$|GBP|£|EUR|€|ZAR|INR|₹|Rs\.?|PHP|₱|MXN|MX\$|XOF|FCFA|CFA|\bN(?=\s?\d)|\bR(?=\s?\d))\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;

const BALANCE_RE = /\b(?:bal(?:ance)?|avail|avl|ledger|new m-?pesa)\b/i;
const CREDIT_RE =
  /\b(?:credit(?:ed)?|cr\b|received|receive[d]?|sent you|deposit(?:ed)?|inflow|incoming)\b/i;
const DEBIT_RE =
  /\b(?:debit(?:ed)?|dr\b|withdrawal|withdrawn|you sent|sent to|paid to|transfer to|outflow)\b/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const NOISE_WORDS = new Set([
  "trf", "transfer", "nip", "frm", "from", "mobile", "mob", "via", "ussd",
  "inward", "outward", "credit", "alert", "web", "pos", "fip", "nibss",
  "ajo", "esusu", "contribution", "savings",
]);

/** Regex capture group, or "" when the group did not participate. */
function group(m: RegExpExecArray | RegExpMatchArray, i: number): string {
  return m[i] ?? "";
}

function monthOf(word: string): number | undefined {
  const w = word.toLowerCase();
  return MONTHS[w.slice(0, 4)] ?? MONTHS[w.slice(0, 3)];
}

function resolveCurrency(token: string): CurrencyCode | null {
  for (const [re, code] of CURRENCY_TOKENS) if (re.test(token)) return code;
  return null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function validDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Day-first everywhere except US dollars, where receipts are month-first. */
export function parseAlertDate(
  text: string,
  monthFirst = false,
): string | null {
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (m) return validDate(+group(m, 1), +group(m, 2), +group(m, 3));

  m = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/.exec(text);
  if (m) {
    const [a, b, y] = [+group(m, 1), +group(m, 2), +group(m, 3)];
    return monthFirst ? validDate(y, a, b) : validDate(y, b, a);
  }

  m = /\b(\d{1,2})[\s-]([A-Za-z]{3,9})[\s,-]*(\d{2,4})\b/.exec(text);
  if (m) {
    const month = monthOf(group(m, 2));
    if (month) return validDate(+group(m, 3), month, +group(m, 1));
  }

  m = /\b([A-Za-z]{3,9})\.?\s(\d{1,2}),?\s(\d{4})\b/.exec(text);
  if (m) {
    const month = monthOf(group(m, 1));
    if (month) return validDate(+group(m, 3), month, +group(m, 2));
  }
  return null;
}

function titleCase(name: string) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function cleanName(raw: string): string | null {
  const words = raw
    .replace(/\+?\d[\d\s-]{6,}/g, " ") // phone numbers
    .replace(/[^A-Za-z.'\-\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w.toLowerCase().replace(/\./g, "")));
  if (!words.length) return null;
  const name = titleCase(words.slice(0, 5).join(" "));
  return name.replace(/[.\-']+$/, "").length >= 2 ? name : null;
}

export function parseSender(text: string): string | null {
  const patterns = [
    /\bNIP\/(?:TRF\/)?(?:FRM\s+)?([A-Za-z][^/\n]{2,60})/i,
    /\b(?:TRF|TRANSFER)\s+(?:FRM|FROM)\s+([A-Za-z][A-Za-z.'\- ]{2,60})/i,
    /\bfrom\s+([A-Za-z][A-Za-z.'\- ]{2,60}?)(?=\s*(?:\+?\d|ref\b|via\b|on\b|at\b|to\b|for\b|[.,;:/(]|\n|$))/i,
    /\bFRM\s+([A-Za-z][A-Za-z.'\- ]{2,60}?)(?=\s*(?:\d|[/.,;\n]|$))/i,
    /^\s*([A-Za-z][A-Za-z.'\- ]{2,60}?)\s+(?:sent you|has sent you|paid you)\b/im,
    /\bsender[:\s]+([A-Za-z][A-Za-z.'\- ]{2,60})/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const name = cleanName(group(m, 1));
      if (name) return name;
    }
  }
  return null;
}

export function parseReference(text: string): string | null {
  const mpesa = /^\s*([A-Z0-9]{10})\s+Confirmed/m.exec(text);
  if (mpesa) return group(mpesa, 1);
  const m =
    /\b(?:ref(?:erence)?(?:\s*no)?|txn(?:\s*id)?|trans(?:action)?\s*id|session\s*id)[:#.\s]*([A-Z0-9][A-Z0-9\-/]{5,40})/i.exec(
      text,
    );
  return m ? group(m, 1).replace(/[/.-]+$/, "") : null;
}

function parseAmount(
  text: string,
): { amountMinor: number; currency: CurrencyCode } | null {
  const lines = text.split(/\n/);
  const candidates: { amountMinor: number; currency: CurrencyCode; score: number }[] = [];
  for (const line of lines) {
    const isBalance = BALANCE_RE.test(line);
    for (const m of line.matchAll(AMOUNT_RE)) {
      // A sentence can mention the amount and then the balance.
      const before = line.slice(0, m.index ?? 0);
      const balanceBefore = BALANCE_RE.test(before.slice(-30));
      const currency = resolveCurrency(group(m, 1));
      if (!currency) continue;
      const major = Number(group(m, 2).replace(/,/g, ""));
      if (!Number.isFinite(major) || major <= 0) continue;
      let score = 1;
      if (isBalance && balanceBefore) score -= 2;
      else if (isBalance) score -= 0.5;
      if (/\b(?:amt|amount|received|credit|sent you|cr)\b/i.test(line)) score += 1;
      candidates.push({ amountMinor: toMinor(major, currency), currency, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return best && best.score > 0 ? best : null;
}

export function parseAlert(raw: string): ParsedAlert {
  const text = raw.trim();
  const amount = parseAmount(text);
  const credit = CREDIT_RE.test(text);
  const debit = DEBIT_RE.test(text);
  const direction = credit && !debit ? "credit" : debit && !credit ? "debit" : credit ? "credit" : "unknown";
  const senderName = parseSender(text);
  const occurredOn = parseAlertDate(text, amount?.currency === "USD");
  const reference = parseReference(text);
  const missing: ParsedAlert["missing"] = [];
  if (!amount) missing.push("amount");
  if (!senderName) missing.push("sender");
  if (!occurredOn) missing.push("date");
  return {
    raw: text,
    direction,
    amountMinor: amount?.amountMinor ?? null,
    currency: amount?.currency ?? null,
    senderName,
    occurredOn,
    reference,
    missing,
  };
}

/**
 * Organizers paste a whole thread of SMS at once. Alerts are separated by
 * blank lines; a block where several lines each read like a full alert is
 * split per line.
 */
export function splitAlerts(text: string): string[] {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const fullLines = lines.filter(
      (l) => new RegExp(AMOUNT_RE.source).test(l) && CREDIT_RE.test(l) && /\bfrom\b|sent you/i.test(l),
    );
    if (lines.length > 1 && fullLines.length === lines.length) out.push(...lines);
    else out.push(block);
  }
  return out;
}

/** Same alert pasted twice (even with different spacing) gets the same fingerprint input. */
export function normalizeForFingerprint(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

export const SUPPORTED_ALERT_CURRENCIES = Object.keys(CURRENCIES);
