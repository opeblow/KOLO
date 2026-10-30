import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { schema } from "../server/db/index.js";
import { withCircleLock } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description:
    "Dismiss an inbox payment that isn't a contribution to this circle (personal transfer, refund, spam, wrong group). Nothing is written to the ledger.",
  schema: z.object({
    circleId: circleIdArg,
    signalId: z.string().describe("Payment id from list-payment-inbox"),
    reason: z.string().trim().min(3).max(200).describe("Why it was dismissed"),
  }),
  run: async (args) =>
    withCircleLock(args.circleId, "editor", async ({ tx, circle }) => {
      const s = schema.paymentSignals;
      const updated = await tx
        .update(s)
        .set({ status: "rejected", resolutionNote: args.reason, resolvedAt: new Date().toISOString() })
        .where(and(eq(s.id, args.signalId), eq(s.circleId, circle.id), eq(s.status, "pending")))
        .returning({ id: s.id });
      if (!updated.length)
        fail("No pending payment with that id.", { errorCode: "not_found", statusCode: 404 });
      return { id: args.signalId, message: "Payment dismissed." };
    }),
});
