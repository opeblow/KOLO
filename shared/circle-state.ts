/**
 * Circle state is a pure fold over the verified ledger. Nothing about money is
 * stored anywhere else, so the books cannot drift from the log. The same fold
 * runs on the server (to enforce rules) and in the browser (so members can
 * re-derive balances from the chain they just verified).
 */
import type {
  AnyEntry,
  ContributionPayload,
  GenesisPayload,
  LedgerEntry,
} from "./ledger";
import { formatMoney } from "./money";
import { daysBetween, roundDueDate } from "./schedule";

export interface RoundState {
  round: number;
  recipientId: string;
  dueDate: string;
  potMinor: number;
  collectedMinor: number;
  /** memberId -> amount paid toward this round. */
  paidBy: Record<string, number>;
  payout: { seq: number; amountMinor: number; recordedAt: string } | null;
}

export interface MemberBalance {
  memberId: string;
  name: string;
  /** 1-based round this member collects (after swaps). */
  payoutRound: number;
  paidMinor: number;
  receivedMinor: number;
  /** Still owed across all rounds, including ones not yet due. */
  outstandingMinor: number;
}

export interface CircleState {
  terms: GenesisPayload;
  size: number;
  potMinor: number;
  /** order[r - 1] collects round r. */
  order: string[];
  rounds: RoundState[];
  members: Record<string, MemberBalance>;
  /** Collected minus paid out: money the organizer should be holding. */
  heldMinor: number;
  /** First round not yet paid out, or null when every round is done. */
  nextPayoutRound: number | null;
  closed: boolean;
  reversedSeqs: Set<number>;
  lastSeq: number;
}

export function foldLedger(entries: readonly AnyEntry[]): CircleState {
  const genesis = entries[0];
  if (!genesis || genesis.kind !== "circle.opened") {
    throw new Error("Ledger must start with circle.opened");
  }
  const terms = genesis.payload;
  const size = terms.members.length;
  const potMinor = terms.contributionMinor * size;
  const order = terms.members.map((m) => m.id);
  const names = Object.fromEntries(terms.members.map((m) => [m.id, m.name]));

  const reversedSeqs = new Set<number>();
  for (const e of entries) {
    if (e.kind === "reversal") reversedSeqs.add(e.payload.targetSeq);
  }

  const rounds: RoundState[] = order.map((recipientId, i) => ({
    round: i + 1,
    recipientId,
    dueDate: roundDueDate(terms.startDate, terms.cadence, i + 1),
    potMinor,
    collectedMinor: 0,
    paidBy: {},
    payout: null,
  }));

  let closed = false;
  for (const e of entries) {
    if (reversedSeqs.has(e.seq)) continue;
    switch (e.kind) {
      case "contribution": {
        const r = rounds[e.payload.round - 1];
        if (!r) break;
        r.paidBy[e.payload.memberId] =
          (r.paidBy[e.payload.memberId] ?? 0) + e.payload.amountMinor;
        r.collectedMinor += e.payload.amountMinor;
        break;
      }
      case "payout": {
        const r = rounds[e.payload.round - 1];
        if (r)
          r.payout = {
            seq: e.seq,
            amountMinor: e.payload.amountMinor,
            recordedAt: e.recordedAt,
          };
        break;
      }
      case "swap": {
        const a = rounds[e.payload.roundA - 1];
        const b = rounds[e.payload.roundB - 1];
        if (a && b) {
          [a.recipientId, b.recipientId] = [b.recipientId, a.recipientId];
          order[a.round - 1] = a.recipientId;
          order[b.round - 1] = b.recipientId;
        }
        break;
      }
      case "circle.closed":
        closed = true;
        break;
    }
  }

  const members: Record<string, MemberBalance> = {};
  for (const id of terms.members.map((m) => m.id)) {
    let paid = 0;
    for (const r of rounds) paid += r.paidBy[id] ?? 0;
    const received = rounds
      .filter((r) => r.recipientId === id && r.payout)
      .reduce((sum, r) => sum + (r.payout?.amountMinor ?? 0), 0);
    members[id] = {
      memberId: id,
      name: names[id] ?? id,
      payoutRound: order.indexOf(id) + 1,
      paidMinor: paid,
      receivedMinor: received,
      outstandingMinor: terms.contributionMinor * size - paid,
    };
  }

  const collected = rounds.reduce((s, r) => s + r.collectedMinor, 0);
  const paidOut = rounds.reduce((s, r) => s + (r.payout?.amountMinor ?? 0), 0);
  const next = rounds.find((r) => !r.payout);

  return {
    terms,
    size,
    potMinor,
    order,
    rounds,
    members,
    heldMinor: collected - paidOut,
    nextPayoutRound: next ? next.round : null,
    closed,
    reversedSeqs,
    lastSeq: entries[entries.length - 1]?.seq ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Rules. Each returns null when allowed, or a violation the caller turns into
// a 409. The server runs these inside a locked transaction; the UI runs the
// same functions to explain a disabled button before anyone clicks it.
// ---------------------------------------------------------------------------

export type RuleCode =
  | "circle_closed"
  | "unknown_member"
  | "invalid_round"
  | "invalid_amount"
  | "overpayment"
  | "round_already_paid"
  | "out_of_order"
  | "round_not_funded"
  | "wrong_recipient"
  | "amount_mismatch"
  | "same_round"
  | "missing_consent"
  | "not_reversible"
  | "already_reversed"
  | "rounds_outstanding";

export interface Violation {
  code: RuleCode;
  message: string;
  details?: Record<string, unknown> | undefined;
}

/** The round, or a thrown error. Callers validate the range first. */
export function roundAt(state: CircleState, round: number): RoundState {
  const r = state.rounds[round - 1];
  if (!r) throw new RangeError(`Round ${round} does not exist`);
  return r;
}

function v(
  code: RuleCode,
  message: string,
  details?: Record<string, unknown>,
): Violation {
  return { code, message, details };
}

function money(state: CircleState, minor: number) {
  return formatMoney(minor, state.terms.currency);
}

function memberName(state: CircleState, id: string) {
  return state.members[id]?.name ?? id;
}

export function checkContribution(
  state: CircleState,
  c: Pick<ContributionPayload, "memberId" | "round" | "amountMinor">,
): Violation | null {
  if (state.closed) return v("circle_closed", "This circle is closed.");
  if (!state.members[c.memberId])
    return v("unknown_member", "That person is not a member of this circle.");
  if (!Number.isInteger(c.round) || c.round < 1 || c.round > state.size)
    return v(
      "invalid_round",
      `Round must be between 1 and ${state.size}.`,
    );
  if (!Number.isInteger(c.amountMinor) || c.amountMinor <= 0)
    return v("invalid_amount", "Amount must be a positive whole number of minor units.");
  const r = roundAt(state, c.round);
  if (r.payout)
    return v(
      "round_already_paid",
      `Round ${c.round} was already paid out.`,
    );
  const already = r.paidBy[c.memberId] ?? 0;
  const room = state.terms.contributionMinor - already;
  if (c.amountMinor > room) {
    return v(
      "overpayment",
      `${memberName(state, c.memberId)} only owes ${money(state, room)} more for round ${c.round}.`,
      { owedMinor: room, attemptedMinor: c.amountMinor },
    );
  }
  return null;
}

export function shortfall(state: CircleState, round: number) {
  const r = roundAt(state, round);
  return state.order
    .map((id) => ({
      memberId: id,
      name: memberName(state, id),
      owedMinor: state.terms.contributionMinor - (r.paidBy[id] ?? 0),
    }))
    .filter((s) => s.owedMinor > 0);
}

export function checkPayout(
  state: CircleState,
  p: { round: number; memberId: string; amountMinor: number },
): Violation | null {
  if (state.closed) return v("circle_closed", "This circle is closed.");
  if (!Number.isInteger(p.round) || p.round < 1 || p.round > state.size)
    return v("invalid_round", `Round must be between 1 and ${state.size}.`);
  const r = roundAt(state, p.round);
  if (r.payout)
    return v("round_already_paid", `Round ${p.round} was already paid out.`);
  if (state.nextPayoutRound !== p.round)
    return v(
      "out_of_order",
      `Rounds pay out in order. Round ${state.nextPayoutRound} is next.`,
      { nextRound: state.nextPayoutRound },
    );
  if (r.collectedMinor < r.potMinor) {
    const missing = shortfall(state, p.round);
    return v(
      "round_not_funded",
      `Round ${p.round} is short ${money(state, r.potMinor - r.collectedMinor)}. Waiting on ${missing.map((m) => m.name).join(", ")}.`,
      {
        shortMinor: r.potMinor - r.collectedMinor,
        waitingOn: missing,
      },
    );
  }
  if (p.memberId !== r.recipientId)
    return v(
      "wrong_recipient",
      `Round ${p.round} belongs to ${memberName(state, r.recipientId)}, not ${memberName(state, p.memberId)}.`,
      { recipientId: r.recipientId },
    );
  if (p.amountMinor !== r.potMinor)
    return v(
      "amount_mismatch",
      `The round ${p.round} pot is ${money(state, r.potMinor)}; the payout must equal it.`,
      { potMinor: r.potMinor },
    );
  return null;
}

export function checkSwap(
  state: CircleState,
  s: { roundA: number; roundB: number; consent: string },
): Violation | null {
  if (state.closed) return v("circle_closed", "This circle is closed.");
  for (const round of [s.roundA, s.roundB]) {
    if (!Number.isInteger(round) || round < 1 || round > state.size)
      return v("invalid_round", `Round must be between 1 and ${state.size}.`);
    if (roundAt(state, round).payout)
      return v(
        "round_already_paid",
        `Round ${round} was already paid out, so its turn can't move.`,
      );
  }
  if (s.roundA === s.roundB)
    return v("same_round", "Pick two different rounds to swap.");
  if (s.consent.trim().length < 8)
    return v(
      "missing_consent",
      "Record how both members agreed to the swap.",
    );
  return null;
}

export function checkReversal(
  state: CircleState,
  entries: readonly AnyEntry[],
  targetSeq: number,
): Violation | null {
  const target = entries.find((e) => e.seq === targetSeq);
  if (!target || target.kind !== "contribution")
    return v("not_reversible", "Only contributions can be reversed.");
  if (state.reversedSeqs.has(targetSeq))
    return v("already_reversed", `Entry #${targetSeq} is already reversed.`);
  if (state.rounds[target.payload.round - 1]?.payout)
    return v(
      "not_reversible",
      `Round ${target.payload.round} was paid out, so its contributions are final.`,
    );
  return null;
}

export function checkClose(state: CircleState): Violation | null {
  if (state.closed) return v("circle_closed", "This circle is already closed.");
  if (state.nextPayoutRound !== null)
    return v(
      "rounds_outstanding",
      `Round ${state.nextPayoutRound} hasn't been paid out yet.`,
    );
  return null;
}

/**
 * Split one payment across a member's earliest unpaid rounds, starting at
 * `fromRound`. 100,000 against a 50,000 contribution covers two rounds.
 */
export function allocatePayment(
  state: CircleState,
  memberId: string,
  amountMinor: number,
  fromRound = 1,
): { allocations: { round: number; amountMinor: number }[]; leftoverMinor: number } {
  const allocations: { round: number; amountMinor: number }[] = [];
  let left = amountMinor;
  for (const r of state.rounds) {
    if (left <= 0) break;
    if (r.round < fromRound || r.payout) continue;
    const room = state.terms.contributionMinor - (r.paidBy[memberId] ?? 0);
    if (room <= 0) continue;
    const take = Math.min(room, left);
    allocations.push({ round: r.round, amountMinor: take });
    left -= take;
  }
  return { allocations, leftoverMinor: left };
}

export interface LatePayment {
  memberId: string;
  name: string;
  round: number;
  dueDate: string;
  owedMinor: number;
  daysLate: number;
}

/** Contributions past due date plus grace days, as of `today`. */
export function latePayments(state: CircleState, today: string): LatePayment[] {
  const late: LatePayment[] = [];
  for (const r of state.rounds) {
    if (r.payout) continue;
    const days = daysBetween(r.dueDate, today) - state.terms.graceDays;
    if (days <= 0) continue;
    for (const id of state.order) {
      const owed = state.terms.contributionMinor - (r.paidBy[id] ?? 0);
      if (owed > 0)
        late.push({
          memberId: id,
          name: memberName(state, id),
          round: r.round,
          dueDate: r.dueDate,
          owedMinor: owed,
          daysLate: days,
        });
    }
  }
  return late;
}

/**
 * Trust exposure: what members who already collected still owe the group.
 * This is the money the circle loses if they walk away, the classic way
 * rotating savings groups fail.
 */
export function trustExposure(state: CircleState) {
  const rows = Object.values(state.members)
    .filter((m) => m.receivedMinor > 0 && m.outstandingMinor > 0)
    .map((m) => ({
      memberId: m.memberId,
      name: m.name,
      outstandingMinor: m.outstandingMinor,
    }));
  return {
    totalMinor: rows.reduce((s, r) => s + r.outstandingMinor, 0),
    members: rows,
  };
}

/** Contribution entries, newest first, that are still in effect. */
export function liveContributions(
  entries: readonly AnyEntry[],
  state: CircleState,
): LedgerEntry<"contribution">[] {
  return entries
    .filter(
      (e): e is LedgerEntry<"contribution"> =>
        e.kind === "contribution" && !state.reversedSeqs.has(e.seq),
    )
    .reverse();
}
