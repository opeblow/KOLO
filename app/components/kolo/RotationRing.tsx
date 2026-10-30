import { useId } from "react";

import { cn } from "@/lib/utils";

import { formatMoney, type CurrencyCode } from "../../../shared/money";
import { firstName, initials, shortDate } from "./brand";

export interface RingRound {
  round: number;
  recipientId: string;
  status: "paid" | "ready" | "collecting" | "overdue" | "upcoming";
  collectedMinor: number;
  potMinor: number;
  dueDate: string;
}

interface RotationRingProps {
  members: { id: string; name: string }[];
  rounds: RingRound[];
  currentRound: number | null;
  currency: string;
  /** Emphasise one member (the viewer on their personal page). */
  highlightId?: string | undefined;
  showNames?: boolean;
  showCenter?: boolean;
  className?: string;
}

const C = 200;
const R = 138;

function polar(angle: number, radius: number) {
  return { x: C + Math.cos(angle) * radius, y: C + Math.sin(angle) * radius };
}

function arcPath(a0: number, a1: number, radius: number) {
  const p0 = polar(a0, radius);
  const p1 = polar(a1, radius);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

/**
 * The rotation as it really is: members sit around the ring in payout order,
 * filled when their round has paid out, ringed in emerald while their round
 * collects. The centre shows the pot filling for the current recipient.
 */
export function RotationRing({
  members,
  rounds,
  currentRound,
  currency,
  highlightId,
  showNames = true,
  showCenter = true,
  className,
}: RotationRingProps) {
  const id = useId();
  const n = rounds.length || members.length;
  const step = (Math.PI * 2) / Math.max(n, 1);
  const start = -Math.PI / 2;
  const nodeR = Math.max(11, Math.min(25, R * Math.sin(Math.PI / Math.max(n, 2)) * 0.62));
  const byId = new Map(members.map((m) => [m.id, m]));
  const current = currentRound ? rounds[currentRound - 1] : undefined;
  const progress = current ? Math.min(1, current.collectedMinor / Math.max(current.potMinor, 1)) : 1;
  const paidCount = rounds.filter((r) => r.status === "paid").length;

  return (
    <svg
      viewBox={showNames ? "-56 -6 512 412" : "0 0 400 400"}
      className={cn("h-auto w-full select-none", className)}
      role="img"
      aria-labelledby={`${id}-t`}
    >
      <title id={`${id}-t`}>
        {`Rotation: ${paidCount} of ${n} rounds paid out${current ? `; round ${current.round} collecting for ${byId.get(current.recipientId)?.name ?? "the next member"}` : ""}`}
      </title>

      {/* Track, then emerald arcs for completed hand-offs. */}
      <circle cx={C} cy={C} r={R} fill="none" className="stroke-border" strokeWidth="1.5" />
      {rounds.map((r, i) =>
        r.status === "paid" && i < n - 1 ? (
          <path
            key={`arc-${r.round}`}
            d={arcPath(start + i * step, start + (i + 1) * step, R)}
            fill="none"
            className="stroke-primary"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : null,
      )}

      {showCenter ? (
        <g>
          <circle cx={C} cy={C} r={84} className="fill-card stroke-border" strokeWidth="1" />
          <circle
            cx={C}
            cy={C}
            r={76}
            fill="none"
            className="stroke-muted"
            strokeWidth="7"
          />
          {progress > 0 ? (
            <circle
              cx={C}
              cy={C}
              r={76}
              fill="none"
              className="stroke-gold transition-[stroke-dashoffset] duration-700"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 76}`}
              strokeDashoffset={`${2 * Math.PI * 76 * (1 - progress)}`}
              transform={`rotate(-90 ${C} ${C})`}
            />
          ) : null}
          {current ? (
            <>
              <text x={C} y={C - 26} textAnchor="middle" className="fill-muted-foreground text-[11px] font-medium uppercase tracking-[0.12em]">
                {`Round ${current.round} of ${n}`}
              </text>
              <text x={C} y={C + 6} textAnchor="middle" className="fill-foreground font-display text-[26px] font-semibold tabular">
                {formatMoney(current.collectedMinor, currency as CurrencyCode, { compact: current.potMinor >= 100_000_000 })}
              </text>
              <text x={C} y={C + 24} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular">
                {`of ${formatMoney(current.potMinor, currency as CurrencyCode, { compact: current.potMinor >= 100_000_000 })}`}
              </text>
              <text x={C} y={C + 44} textAnchor="middle" className="fill-foreground text-[11.5px] font-medium">
                {`for ${firstName(byId.get(current.recipientId)?.name ?? "")} · ${shortDate(current.dueDate)}`}
              </text>
            </>
          ) : (
            <>
              <text x={C} y={C - 4} textAnchor="middle" className="fill-foreground font-display text-[22px] font-semibold">
                Complete
              </text>
              <text x={C} y={C + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {`${n} of ${n} rounds paid`}
              </text>
            </>
          )}
        </g>
      ) : null}

      {rounds.map((r, i) => {
        const angle = start + i * step;
        const p = polar(angle, R);
        const member = byId.get(r.recipientId);
        const name = member?.name ?? "";
        const isCurrent = currentRound === r.round;
        const isMe = highlightId === r.recipientId;
        const label = polar(angle, R + nodeR + 16);
        const anchor = Math.abs(Math.cos(angle)) < 0.3 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
        return (
          <g key={r.round}>
            {isCurrent ? (
              <circle cx={p.x} cy={p.y} r={nodeR + 7} className="fill-primary/10 stroke-primary/30" strokeWidth="1">
                <animate attributeName="r" values={`${nodeR + 4};${nodeR + 9};${nodeR + 4}`} dur="2.4s" repeatCount="indefinite" />
              </circle>
            ) : null}
            <circle
              cx={p.x}
              cy={p.y}
              r={nodeR}
              strokeWidth={isCurrent ? 2.5 : 1.5}
              className={cn(
                r.status === "paid"
                  ? "fill-primary stroke-primary"
                  : isCurrent
                    ? r.status === "overdue"
                      ? "fill-card stroke-clay"
                      : "fill-card stroke-primary"
                    : "fill-background stroke-border",
                isMe && r.status !== "paid" && "stroke-gold",
              )}
            />
            {isMe ? (
              <circle cx={p.x} cy={p.y} r={nodeR + 3.5} fill="none" className="stroke-gold" strokeWidth="2" />
            ) : null}
            <text
              x={p.x}
              y={p.y + nodeR * 0.16}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: Math.max(8, nodeR * 0.62) }}
              className={cn(
                "font-semibold",
                r.status === "paid" ? "fill-primary-foreground" : "fill-foreground",
              )}
            >
              {initials(name)}
            </text>
            {showNames ? (
              <text
                x={label.x}
                y={label.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                className={cn(
                  "text-[11.5px]",
                  isCurrent || isMe ? "fill-foreground font-semibold" : "fill-muted-foreground",
                )}
              >
                {firstName(name)}
                <tspan className="fill-muted-foreground font-normal">{` · ${r.round}`}</tspan>
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
