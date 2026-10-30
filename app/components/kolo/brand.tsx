import { IconCircleCheckFilled, IconAlertTriangleFilled } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import { formatMoney, type CurrencyCode } from "../../../shared/money";

/**
 * The Kolo mark: eight members around a ring, one holding the pot.
 * "Kolo" is Nigerian slang for a clay savings box.
 */
export function KoloMark({ className }: { className?: string }) {
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return { x: 16 + Math.cos(a) * 11, y: 16 + Math.sin(a) * 11, i };
  });
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <circle cx="16" cy="16" r="11" fill="none" className="stroke-primary-foreground/25" strokeWidth="1.25" />
      {dots.map((d) => (
        <circle
          key={d.i}
          cx={d.x}
          cy={d.y}
          r={d.i === 0 ? 3.4 : 1.9}
          className={d.i === 0 ? "fill-gold" : "fill-primary-foreground"}
        />
      ))}
      <circle cx="16" cy="16" r="3.2" className="fill-primary-foreground" />
    </svg>
  );
}

export function KoloWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <KoloMark />
      <span className="font-display text-[1.35rem] font-bold leading-none tracking-tight">kolo</span>
    </span>
  );
}

/** The ledger seal: the first 8 hex chars of the chain head, readable aloud. */
export function Seal({
  seal,
  ok = true,
  className,
  size = "sm",
}: {
  seal: string;
  ok?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-mono tabular",
        size === "sm" ? "h-6 px-2 text-[11px]" : "h-8 px-3 text-xs",
        ok
          ? "border-primary/25 bg-accent text-accent-foreground"
          : "border-clay/40 bg-clay/10 text-clay",
        className,
      )}
      title={ok ? "Ledger seal: fingerprint of the newest verified entry" : "Ledger failed verification"}
    >
      {ok ? (
        <IconCircleCheckFilled className={size === "sm" ? "size-3.5" : "size-4"} />
      ) : (
        <IconAlertTriangleFilled className={size === "sm" ? "size-3.5" : "size-4"} />
      )}
      {seal}
    </span>
  );
}

export function Money({
  minor,
  currency,
  className,
  compact,
  sign,
}: {
  minor: number;
  currency: string;
  className?: string;
  compact?: boolean;
  sign?: boolean;
}) {
  return (
    <span className={cn("tabular", className)}>
      {formatMoney(minor, currency as CurrencyCode, { compact: !!compact, sign: !!sign })}
    </span>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function shortDate(iso: string, opts?: { weekday?: boolean }) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(opts?.weekday ? { weekday: "short" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

export function relativeDays(fromIso: string, toIso: string) {
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`);
  const d = Math.round(ms / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

export const CADENCE_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};
