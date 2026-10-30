import { defineAction } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { checkReversal } from "../shared/circle-state.js";
import { sealOf } from "../shared/ledger.js";
import { schema } from "../server/db/index.js";
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
    "Undo a contribution recorded by mistake (wrong member, bounced transfer) by appending a reversal. The original entry stays visible forever; history is never edited. Contributions in a round that already paid out are final. If the contribution came from an inbox payment, that payment returns to the inbox to be matched again.",
  schema: z.object({
    circleId: circleIdArg,
    seq: z.number().int().min(1).describe("Ledger entry number (#) to reverse"),
    reason: z.string().trim().min(8).max(200).describe("Why, e.g. 'Matched to the wrong Bisi'"),
  }),
  run: async (args, ctx) => {
    const by = requireUser(ctx);
    return withCircleLock(args.circleId, "editor", async (locked) => {
      const state = requireActive(locked);
      const violation = checkReversal(state, locked.entries, args.seq);
      if (violation) failRule(violation);
      const target = locked.entries.find((e) => e.seq === args.seq);
      const entry = await appendOne(locked, { kind: "reversal", payload: { targetSeq: args.seq, reason: args.reason } }, { via: viaFromCaller(ctx), by });
      const signalId =
        target?.kind === "contribution" ? target.payload.signalId : undefined;
      if (signalId) {
        await locked.tx
          .update(schema.paymentSignals)
          .set({ status: "pending", ledgerSeqs: null, resolvedAt: null, resolutionNote: `Reversed: ${args.reason}` })
          .where(and(eq(schema.paymentSignals.id, signalId), eq(schema.paymentSignals.circleId, locked.circle.id)));
      }
      return {
        id: locked.circle.id,
        ledgerSeq: entry.seq,
        seal: sealOf(entry.hash),
        message: `Entry #${args.seq} reversed by entry #${entry.seq}.${signalId ? " Its bank alert is back in the inbox." : ""}`,
      };
    });
  },
});
