import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { sealOf } from "../shared/ledger.js";
import { toMinor } from "../shared/money.js";
import { schema } from "../server/db/index.js";
import { requireActive, requireUser, viaFromCaller, withCircleLock } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";
import { confirmSignal, rejectViolation } from "../server/lib/payments.js";

export default defineAction({
  description:
    "Confirm one inbox payment and record it in the ledger as contributions. Uses the proposed member unless memberId overrides it; a payment larger than one contribution is split across that member's next unpaid rounds. Overpayments and closed rounds are refused with a reason. By default the bank's spelling of the sender is saved as an alias so future alerts match automatically.",
  schema: z.object({
    circleId: circleIdArg,
    signalId: z.string().describe("Payment id from list-payment-inbox"),
    memberId: z.string().optional().describe("Override the proposed member"),
    startRound: z.number().int().min(1).optional().describe("Apply from this round instead of the earliest unpaid one"),
    amount: z.number().positive().optional().describe("Correct the amount (major units) if the alert was misread"),
    rememberBankName: z.boolean().default(true).describe("Save the sender's bank name as an alias for this member"),
  }),
  run: async (args, ctx) => {
    const by = requireUser(ctx);
    return withCircleLock(args.circleId, "editor", async (locked) => {
      const state = requireActive(locked);
      const [signal] = await locked.tx
        .select()
        .from(schema.paymentSignals)
        .where(
          and(eq(schema.paymentSignals.id, args.signalId), eq(schema.paymentSignals.circleId, locked.circle.id)),
        )
        .limit(1);
      if (!signal) fail("Payment not found.", { errorCode: "not_found", statusCode: 404 });
      const result = await confirmSignal(locked, signal, {
        memberId: args.memberId,
        startRound: args.startRound,
        amountMinor: args.amount !== undefined ? toMinor(args.amount, state.terms.currency) : undefined,
        rememberBankName: args.rememberBankName,
        via: viaFromCaller(ctx),
        by,
      });
      if (!result.ok) rejectViolation(result.violation);
      return {
        id: signal.id,
        memberName: result.memberName,
        rounds: result.rounds,
        ledgerSeqs: result.seqs,
        learnedAlias: result.learnedAlias,
        seal: sealOf(locked.circle.headHash),
        message: `Recorded ${result.memberName}'s payment for round ${result.rounds.join(", ")} (entries #${result.seqs.join(", #")}).${result.learnedAlias ? ` Saved "${result.learnedAlias}" as their bank name.` : ""}`,
      };
    });
  },
});
