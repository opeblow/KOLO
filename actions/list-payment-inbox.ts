import { defineAction } from "@agent-native/core/action";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { checkCircleAccess } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description:
    "List payments in a circle's inbox: pasted bank alerts with the proposed member, rounds, confidence (0–100), and the reasons behind each match. Defaults to pending ones awaiting a decision.",
  schema: z.object({
    circleId: circleIdArg,
    status: z.enum(["pending", "confirmed", "rejected", "all"]).default("pending").describe("Which payments to list"),
    limit: z.coerce.number().int().min(1).max(200).default(100).describe("Max rows"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async (args) => {
    await checkCircleAccess(args.circleId, "viewer");
    const s = schema.paymentSignals;
    const rows = await getDb()
      .select()
      .from(s)
      .where(
        and(
          eq(s.circleId, args.circleId),
          args.status === "all" ? undefined : eq(s.status, args.status),
        ),
      )
      .orderBy(desc(s.createdAt))
      .limit(args.limit);
    return {
      payments: rows.map((r) => {
        let proposal: {
          allocations?: { round: number; amountMinor: number }[];
          reasons?: string[];
          alternatives?: { memberId: string; name: string; score: number }[];
          leftoverMinor?: number;
        } = {};
        try {
          proposal = JSON.parse(r.proposal);
        } catch {}
        return {
          id: r.id,
          rawText: r.rawText,
          direction: r.direction,
          amountMinor: r.amountMinor,
          currency: r.currency,
          senderName: r.senderName,
          occurredOn: r.occurredOn,
          reference: r.reference,
          extractedBy: r.extractedBy,
          status: r.status,
          memberId: r.proposedMemberId,
          confidence: r.confidence,
          rounds: proposal.allocations?.map((a) => a.round) ?? [],
          reasons: proposal.reasons ?? [],
          alternatives: proposal.alternatives ?? [],
          ledgerSeqs: r.ledgerSeqs ? (JSON.parse(r.ledgerSeqs) as number[]) : [],
          resolutionNote: r.resolutionNote,
          createdAt: r.createdAt,
        };
      }),
    };
  },
});
