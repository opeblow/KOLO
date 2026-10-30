import { fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";

import {
  allocatePayment,
  checkContribution,
  type Violation,
} from "../../shared/circle-state.js";
import { formatMoney } from "../../shared/money.js";
import { nameSimilarity } from "../../shared/matcher.js";
import { schema } from "../db/index.js";
import {
  appendEntries,
  parseAliases,
  readMembers,
  requireActive,
  type Locked,
} from "./circles.js";

export type SignalRow = typeof schema.paymentSignals.$inferSelect;

export interface ConfirmOptions {
  memberId?: string | undefined;
  startRound?: number | undefined;
  amountMinor?: number | undefined;
  rememberBankName?: boolean | undefined;
  via: string;
  by: string;
}

/**
 * Turn one pending payment into ledger contributions. Returns a violation
 * instead of throwing so bulk confirmation can skip one bad row and report it.
 */
export async function confirmSignal(
  locked: Locked,
  signal: SignalRow,
  opts: ConfirmOptions,
): Promise<
  | { ok: true; seqs: number[]; memberId: string; memberName: string; rounds: number[]; learnedAlias: string | null }
  | { ok: false; violation: Violation }
> {
  const state = requireActive(locked);
  const currency = state.terms.currency;
  if (signal.status !== "pending")
    return {
      ok: false,
      violation: { code: "invalid_amount", message: `This payment was already ${signal.status}.` },
    };
  if (signal.direction === "debit")
    return { ok: false, violation: { code: "invalid_amount", message: "Money going out is not a contribution." } };
  if (signal.currency && signal.currency !== currency)
    return {
      ok: false,
      violation: {
        code: "invalid_amount",
        message: `This alert is in ${signal.currency} but the circle runs in ${currency}.`,
      },
    };
  const amount = opts.amountMinor ?? signal.amountMinor;
  if (!amount)
    return { ok: false, violation: { code: "invalid_amount", message: "The amount is unknown; set it before confirming." } };
  const memberId = opts.memberId ?? signal.proposedMemberId;
  if (!memberId || !state.members[memberId])
    return { ok: false, violation: { code: "unknown_member", message: "Pick which member sent this payment." } };

  const { allocations, leftoverMinor } = allocatePayment(state, memberId, amount, opts.startRound ?? 1);
  if (leftoverMinor > 0 || !allocations.length)
    return {
      ok: false,
      violation: {
        code: "overpayment",
        message: `${formatMoney(amount, currency)} is more than ${state.members[memberId].name} owes${opts.startRound ? ` from round ${opts.startRound}` : ""} (${formatMoney(leftoverMinor || amount, currency)} over). Refund the difference or check the amount.`,
        details: { leftoverMinor },
      },
    };
  for (const a of allocations) {
    const violation = checkContribution(state, { memberId, round: a.round, amountMinor: a.amountMinor });
    if (violation) return { ok: false, violation };
  }

  const sealed = await appendEntries(
    locked,
    allocations.map((a) => ({
      kind: "contribution" as const,
      payload: {
        memberId,
        round: a.round,
        amountMinor: a.amountMinor,
        method: "transfer" as const,
        signalId: signal.id,
        ...(signal.reference ? { reference: signal.reference } : {}),
        ...(signal.occurredOn ? { note: `Bank alert dated ${signal.occurredOn}` } : {}),
      },
    })),
    { via: opts.via, by: opts.by },
  );
  const seqs = sealed.map((e) => e.seq);
  const now = new Date().toISOString();
  await locked.tx
    .update(schema.paymentSignals)
    .set({
      status: "confirmed",
      proposedMemberId: memberId,
      ledgerSeqs: JSON.stringify(seqs),
      resolvedAt: now,
      ...(opts.amountMinor ? { amountMinor: opts.amountMinor } : {}),
    })
    .where(eq(schema.paymentSignals.id, signal.id));

  // Learn the bank's spelling so the next alert from this account matches itself.
  let learnedAlias: string | null = null;
  if (opts.rememberBankName !== false && signal.senderName) {
    const members = await readMembers(locked.tx, locked.circle.id);
    const member = members.find((m) => m.id === memberId);
    if (member) {
      const aliases = parseAliases(member.aliases);
      const known = [member.name, ...aliases].some(
        (n) => nameSimilarity(signal.senderName!, n) >= 0.9,
      );
      if (!known) {
        learnedAlias = signal.senderName;
        await locked.tx
          .update(schema.members)
          .set({ aliases: JSON.stringify([...aliases, signal.senderName].slice(0, 20)) })
          .where(eq(schema.members.id, member.id));
      }
    }
  }

  return {
    ok: true,
    seqs,
    memberId,
    memberName: state.members[memberId].name,
    rounds: allocations.map((a) => a.round),
    learnedAlias,
  };
}

export function rejectViolation(violation: Violation): never {
  fail(violation.message, {
    errorCode: violation.code,
    statusCode: 409,
    ...(violation.details ? { details: violation.details } : {}),
  });
}
