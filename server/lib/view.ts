/**
 * Shapes a circle for screens and for the agent. Everything numeric is
 * derived from the ledger fold; nothing here writes.
 */
import {
  foldLedger,
  latePayments,
  roundAt,
  shortfall,
  trustExposure,
  type CircleState,
} from "../../shared/circle-state.js";
import {
  sealOf,
  verifyChain,
  type AnyEntry,
  type GenesisPayload,
  type VerifyResult,
} from "../../shared/ledger.js";
import type { CurrencyCode } from "../../shared/money.js";
import { todayIn, type Cadence } from "../../shared/schedule.js";
import { parseAliases, type CircleRow, type MemberRow } from "./circles.js";

export type RoundStatus = "paid" | "ready" | "collecting" | "overdue" | "upcoming";

export function genesisFromDraft(circle: CircleRow, members: MemberRow[]): GenesisPayload {
  return {
    circleId: circle.id,
    name: circle.name,
    currency: circle.currency as CurrencyCode,
    contributionMinor: circle.contributionMinor,
    cadence: circle.cadence as Cadence,
    startDate: circle.startDate,
    graceDays: circle.graceDays,
    members: [...members]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ id: m.id, name: m.name })),
  };
}

/** Draft circles have no ledger yet; preview the schedule from a dry genesis. */
export function stateFor(
  circle: CircleRow,
  members: MemberRow[],
  entries: AnyEntry[],
): CircleState | null {
  if (entries.length) return foldLedger(entries);
  if (!members.length) return null;
  return foldLedger([
    {
      seq: 1,
      kind: "circle.opened",
      payload: genesisFromDraft(circle, members),
      recordedAt: circle.createdAt,
      prevHash: "",
      hash: "",
    },
  ]);
}

export function roundStatus(
  state: CircleState,
  round: number,
  today: string,
): RoundStatus {
  const r = roundAt(state, round);
  if (r.payout) return "paid";
  if (r.collectedMinor >= r.potMinor) return "ready";
  if (round !== state.nextPayoutRound) return "upcoming";
  const late = latePayments(state, today).some((l) => l.round === round);
  return late ? "overdue" : "collecting";
}

export interface BuildOptions {
  includePrivate: boolean;
  pendingSignals?: number;
  lastNudges?: Record<string, string>;
  now?: Date;
}

export async function buildCircleView(
  circle: CircleRow,
  members: MemberRow[],
  entries: AnyEntry[],
  opts: BuildOptions,
) {
  const today = todayIn(circle.timezone, opts.now);
  const state = stateFor(circle, members, entries);
  const integrity: VerifyResult = entries.length
    ? await verifyChain(entries)
    : { ok: true, count: 0, headHash: circle.headHash };
  const headMatches = !integrity.ok || integrity.headHash === circle.headHash;

  const memberRows = members.map((m) => {
    const bal = state?.members[m.id];
    return {
      id: m.id,
      name: m.name,
      position: m.position,
      payoutRound: bal?.payoutRound ?? m.position,
      paidMinor: bal?.paidMinor ?? 0,
      receivedMinor: bal?.receivedMinor ?? 0,
      outstandingMinor: bal?.outstandingMinor ?? 0,
      ...(opts.includePrivate
        ? {
            phone: m.phone,
            aliases: parseAliases(m.aliases),
            memberToken: m.memberToken,
            lastNudgedAt: opts.lastNudges?.[m.id] ?? null,
          }
        : {}),
    };
  });

  const rounds =
    state?.rounds.map((r) => ({
      round: r.round,
      recipientId: r.recipientId,
      dueDate: r.dueDate,
      potMinor: r.potMinor,
      collectedMinor: r.collectedMinor,
      paidCount: Object.values(r.paidBy).filter(
        (v) => v >= (state.terms.contributionMinor ?? 0),
      ).length,
      paidBy: r.paidBy,
      payout: r.payout,
      status: entries.length ? roundStatus(state, r.round, today) : ("upcoming" as RoundStatus),
      waitingOn: r.payout ? [] : shortfall(state, r.round),
    })) ?? [];

  const totalCollected = rounds.reduce((s, r) => s + r.collectedMinor, 0);
  const totalPaidOut = rounds.reduce((s, r) => s + (r.payout?.amountMinor ?? 0), 0);

  return {
    circle: {
      id: circle.id,
      name: circle.name,
      currency: circle.currency as CurrencyCode,
      contributionMinor: circle.contributionMinor,
      potMinor: circle.contributionMinor * members.length,
      cadence: circle.cadence as Cadence,
      startDate: circle.startDate,
      graceDays: circle.graceDays,
      timezone: circle.timezone,
      status: circle.status,
      headSeq: circle.headSeq,
      headHash: circle.headHash,
      seal: sealOf(circle.headHash),
      updatedAt: circle.updatedAt,
      ...(opts.includePrivate ? { publicToken: circle.publicToken } : {}),
    },
    members: memberRows,
    rounds,
    currentRound: state?.nextPayoutRound ?? null,
    heldMinor: state && entries.length ? state.heldMinor : 0,
    totalCollectedMinor: entries.length ? totalCollected : 0,
    totalPaidOutMinor: totalPaidOut,
    late: state && entries.length ? latePayments(state, today) : [],
    exposure: state && entries.length ? trustExposure(state) : { totalMinor: 0, members: [] },
    integrity: { ...integrity, headMatches },
    pendingSignals: opts.pendingSignals ?? 0,
    today,
  };
}

export type CircleView = Awaited<ReturnType<typeof buildCircleView>>;
