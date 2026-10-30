import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { allocatePayment, checkContribution } from "../shared/circle-state.js";
import { sealOf } from "../shared/ledger.js";
import { formatMoney, toMinor } from "../shared/money.js";
import {
  appendEntries,
  failRule,
  requireActive,
  requireUser,
  viaFromCaller,
  withCircleLock,
} from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description:
    "Record a contribution that didn't come through a bank alert, such as cash handed over at a meeting. Without a round, the amount fills the member's earliest unpaid rounds. Overpayment and paid-out rounds are refused.",
  schema: z.object({
    circleId: circleIdArg,
    memberId: z.string().describe("Member id from get-circle"),
    amount: z.number().positive().describe("Amount in major units"),
    round: z.number().int().min(1).optional().describe("Specific round; omit to fill the earliest unpaid rounds"),
    method: z.enum(["cash", "transfer", "other"]).default("cash").describe("How it was paid"),
    note: z.string().trim().max(200).optional().describe("Optional note, e.g. 'Paid at Sunday meeting'"),
  }),
  run: async (args, ctx) => {
    const by = requireUser(ctx);
    return withCircleLock(args.circleId, "editor", async (locked) => {
      const state = requireActive(locked);
      const amountMinor = toMinor(args.amount, state.terms.currency);
      const allocations = args.round
        ? [{ round: args.round, amountMinor }]
        : (() => {
            const a = allocatePayment(state, args.memberId, amountMinor);
            if (a.leftoverMinor > 0 || !a.allocations.length)
              failRule({
                code: "overpayment",
                message: `${formatMoney(amountMinor, state.terms.currency)} is more than ${state.members[args.memberId]?.name ?? "this member"} owes for the rest of the circle.`,
                details: { leftoverMinor: a.leftoverMinor },
              });
            return a.allocations;
          })();
      for (const a of allocations) {
        const violation = checkContribution(state, { memberId: args.memberId, round: a.round, amountMinor: a.amountMinor });
        if (violation) failRule(violation);
      }
      const sealed = await appendEntries(
        locked,
        allocations.map((a) => ({
          kind: "contribution" as const,
          payload: {
            memberId: args.memberId,
            round: a.round,
            amountMinor: a.amountMinor,
            method: args.method,
            ...(args.note ? { note: args.note } : {}),
          },
        })),
        { via: viaFromCaller(ctx), by },
      );
      return {
        id: locked.circle.id,
        ledgerSeqs: sealed.map((e) => e.seq),
        rounds: allocations.map((a) => a.round),
        seal: sealOf(locked.circle.headHash),
        message: `Recorded ${formatMoney(amountMinor, state.terms.currency)} from ${state.members[args.memberId]?.name ?? "member"} for round ${allocations.map((a) => a.round).join(", ")}.`,
      };
    });
  },
});
