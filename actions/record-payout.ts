import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { checkPayout } from "../shared/circle-state.js";
import { sealOf } from "../shared/ledger.js";
import { formatMoney, toMinor } from "../shared/money.js";
import {
  appendOne,
  failRule,
  requireActive,
  requireUser,
  viaFromCaller,
  withCircleLock,
} from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description:
    "Record that a round's pot was paid to its recipient. Enforced rules that nobody (including you) can override: rounds pay in order, the round must be fully funded, the recipient must be the scheduled member, and the amount must equal the pot. A refusal (errorCode round_not_funded, out_of_order, wrong_recipient, amount_mismatch) is final: report who is still owed and stop; never record fake contributions to unblock it.",
  schema: z.object({
    circleId: circleIdArg,
    round: z.number().int().min(1).describe("Round number being paid out"),
    memberId: z.string().optional().describe("Who received it; defaults to the scheduled recipient"),
    amount: z.number().positive().optional().describe("Amount paid in major units; defaults to the full pot"),
    reference: z.string().trim().max(60).optional().describe("Transfer reference for the payout"),
    note: z.string().trim().max(200).optional().describe("Optional note"),
  }),
  run: async (args, ctx) => {
    const by = requireUser(ctx);
    return withCircleLock(args.circleId, "editor", async (locked) => {
      const state = requireActive(locked);
      const round = state.rounds[args.round - 1];
      const memberId = args.memberId ?? round?.recipientId ?? "";
      const amountMinor =
        args.amount !== undefined ? toMinor(args.amount, state.terms.currency) : state.potMinor;
      const violation = checkPayout(state, { round: args.round, memberId, amountMinor });
      if (violation) failRule(violation);
      const entry = await appendOne(
        locked,
        {
          kind: "payout",
          payload: {
            memberId,
            round: args.round,
            amountMinor,
            ...(args.reference ? { reference: args.reference } : {}),
            ...(args.note ? { note: args.note } : {}),
          },
        },
        { via: viaFromCaller(ctx), by },
      );
      const done = locked.state?.nextPayoutRound === null;
      return {
        id: locked.circle.id,
        ledgerSeq: entry.seq,
        seal: sealOf(entry.hash),
        message: `Paid ${formatMoney(amountMinor, state.terms.currency)} to ${state.members[memberId]?.name ?? "member"} for round ${args.round}. Seal ${sealOf(entry.hash)}.`,
        ...(done ? { nextRequiredAction: "Every round is paid. Offer to close the circle with close-circle." } : {}),
      };
    });
  },
});
