import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { proposeMatch } from "../shared/matcher.js";
import { toMinor } from "../shared/money.js";
import { isCalendarDate } from "../shared/schedule.js";
import { schema } from "../server/db/index.js";
import { parseAliases, readMembers, requireActive, withCircleLock } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description:
    "Fill in or correct fields on a pending inbox payment that the parser misread (amount, sender, date, reference), then re-run matching. Use after reading the raw alert text yourself. Only change what the alert actually says.",
  schema: z.object({
    circleId: circleIdArg,
    signalId: z.string().describe("Payment id from list-payment-inbox"),
    amount: z.number().positive().optional().describe("Amount in major units, as printed on the alert"),
    senderName: z.string().trim().min(2).max(80).optional().describe("Sender name as printed"),
    occurredOn: z.string().refine(isCalendarDate, "Use YYYY-MM-DD").optional().describe("Payment date YYYY-MM-DD"),
    reference: z.string().trim().max(60).optional().describe("Bank reference"),
  }),
  run: async (args) =>
    withCircleLock(args.circleId, "editor", async (locked) => {
      const state = requireActive(locked);
      const s = schema.paymentSignals;
      const [signal] = await locked.tx
        .select()
        .from(s)
        .where(and(eq(s.id, args.signalId), eq(s.circleId, locked.circle.id)))
        .limit(1);
      if (!signal) fail("Payment not found.", { errorCode: "not_found", statusCode: 404 });
      if (signal.status !== "pending")
        fail(`This payment was already ${signal.status}.`, { errorCode: "already_resolved", statusCode: 409 });

      const amountMinor =
        args.amount !== undefined ? toMinor(args.amount, state.terms.currency) : signal.amountMinor;
      const senderName = args.senderName ?? signal.senderName;
      const members = await readMembers(locked.tx, locked.circle.id);
      const proposal = proposeMatch(
        state,
        members.map((m) => ({ id: m.id, name: m.name, aliases: parseAliases(m.aliases) })),
        { senderName, amountMinor },
      );
      proposal.reasons.unshift("Fields corrected by the Kolo agent.");
      await locked.tx
        .update(s)
        .set({
          amountMinor,
          senderName,
          currency: args.amount !== undefined ? state.terms.currency : signal.currency,
          direction: signal.direction === "unknown" && amountMinor ? "credit" : signal.direction,
          occurredOn: args.occurredOn ?? signal.occurredOn,
          reference: args.reference ?? signal.reference,
          extractedBy: "agent",
          proposedMemberId: proposal.memberId,
          proposal: JSON.stringify(proposal),
          confidence: proposal.confidence,
        })
        .where(eq(s.id, signal.id));
      return {
        id: signal.id,
        memberId: proposal.memberId,
        memberName: members.find((m) => m.id === proposal.memberId)?.name ?? null,
        confidence: proposal.confidence,
        reasons: proposal.reasons,
        message: "Payment updated and re-matched.",
      };
    }),
});
