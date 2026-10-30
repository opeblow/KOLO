/**
 * Money is always an integer count of minor units (kobo, cents, paise).
 * Floats never touch a balance. Formatting happens only at the edge.
 */

export const CURRENCIES = {
  NGN: { symbol: "₦", minor: 2, name: "Nigerian naira" },
  GHS: { symbol: "GH₵", minor: 2, name: "Ghanaian cedi" },
  KES: { symbol: "KSh", minor: 2, name: "Kenyan shilling" },
  ZAR: { symbol: "R", minor: 2, name: "South African rand" },
  XOF: { symbol: "CFA", minor: 0, name: "West African CFA franc" },
  USD: { symbol: "$", minor: 2, name: "US dollar" },
  GBP: { symbol: "£", minor: 2, name: "British pound" },
  EUR: { symbol: "€", minor: 2, name: "Euro" },
  MXN: { symbol: "MX$", minor: 2, name: "Mexican peso" },
  INR: { symbol: "₹", minor: 2, name: "Indian rupee" },
  PHP: { symbol: "₱", minor: 2, name: "Philippine peso" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as [
  CurrencyCode,
  ...CurrencyCode[],
];

export function isCurrency(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

/** Major units (e.g. 50000.5 naira) to minor units (5000050 kobo). */
export function toMinor(major: number, currency: CurrencyCode): number {
  if (!Number.isFinite(major)) throw new RangeError("Amount is not a number");
  const factor = 10 ** CURRENCIES[currency].minor;
  return Math.round(major * factor);
}

export function toMajor(minor: number, currency: CurrencyCode): number {
  return minor / 10 ** CURRENCIES[currency].minor;
}

/** "₦50,000" — drops the fraction when it is zero. */
export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  opts: { compact?: boolean; sign?: boolean } = {},
): string {
  const { symbol, minor: digits } = CURRENCIES[currency];
  const major = toMajor(Math.abs(minor), currency);
  const hasFraction = digits > 0 && Math.abs(minor) % 10 ** digits !== 0;
  const body = opts.compact
    ? new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(major)
    : new Intl.NumberFormat("en", {
        minimumFractionDigits: hasFraction ? digits : 0,
        maximumFractionDigits: hasFraction ? digits : 0,
      }).format(major);
  const sign = minor < 0 ? "−" : opts.sign && minor > 0 ? "+" : "";
  return `${sign}${symbol}${body}`;
}
