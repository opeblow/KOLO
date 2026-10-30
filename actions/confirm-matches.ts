import { defineAction } from "@agent-native/core/action";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";

import { sealOf } from "../shared/ledger.js";
import { schema } from "../server/db/index.js";
import { requireActive, requireUser, viaFromCaller, withCircleLock } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";
import { confirmSignal } from "../server/lib/payments.js";

export default defineAction({
  description:
    "Confirm every pending inbox payment whose match confidence is at least minConfidence (default 85), in one transaction. Payments that break a rule are skipped and reported, not forced. Use for the routine bulk of a week's alerts; review the rest one by one.",
  schema: z.object({
    circleId: circleIdArg,
    minConfidence: z.number().int().min(60).max(100).default(85).describe("Only confirm matches at or above this score"),
    signalIds: z.array(z.string()).max(200).optional().describe("Limit to these payment ids"),
  }),
  run: async (args, ctx) => {
    const by = requireUser(ctx);
    return withCircleLock(args.circleId, "editor", async (locked) => {
      requireActive(locked);
      const s = schema.paymentSignals;
      const rows = await locked.tx
        .select()
        .from(s)
        .where(
          and(
            eq(s.circleId, locked.circle.id),
            eq(s.status, "pending"),
            gte(s.confidence, args.minConfidence),
            args.signalIds?.length ? inArray(s.id, args.signalIds) : undefined,
          ),
        )
        .orderBy(desc(s.confidence), s.createdAt)
        .limit(200);

      const confirmed: { id: string; memberName: string; rounds: number[] }[] = [];
      const skipped: { id: string; why: string }[] = [];
      for (const row of rows) {
        const r = await confirmSignal(locked, row, { via: viaFromCaller(ctx), by });
        if (r.ok) confirmed.push({ id: row.id, memberName: r.memberName, rounds: r.rounds });
        else skipped.push({ id: row.id, why: r.violation.message });
      }
      return {
        id: locked.circle.id,
        confirmed,
        skipped,
        seal: sealOf(locked.circle.headHash),
        message: `Confirmed ${confirmed.length} payment(s)${skipped.length ? `, skipped ${skipped.length}` : ""}.`,
      };
    });
  },
});
