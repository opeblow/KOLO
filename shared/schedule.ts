/**
 * Round due dates are calendar dates ("2026-11-15"), not instants. A circle in
 * Lagos and a member in London agree on which day a contribution is due, so we
 * never convert them through a timezone.
 */

export const CADENCES = ["weekly", "biweekly", "monthly"] as const;
export type Cadence = (typeof CADENCES)[number];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

function parse(value: string): Date {
  if (!isCalendarDate(value)) throw new RangeError(`Bad date: ${value}`);
  const [y = 0, m = 1, d = 1] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const d = parse(value);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
}

/** Adds months, clamping to the last day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(value: string, months: number): string {
  const d = parse(value);
  const day = d.getUTCDate();
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return fmt(target);
}

/** Due date of a 1-based round. */
export function roundDueDate(
  startDate: string,
  cadence: Cadence,
  round: number,
): string {
  const i = round - 1;
  switch (cadence) {
    case "weekly":
      return addDays(startDate, i * 7);
    case "biweekly":
      return addDays(startDate, i * 14);
    case "monthly":
      return addMonths(startDate, i);
  }
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export function todayIn(timeZone = "UTC", now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
