import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { checkCircleAccess, readLedger } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description:
    "Read a circle's hash-chained ledger, newest first: every opening, contribution, payout, swap, reversal, and close, with who recorded it (app, agent, MCP, CLI) and its hash. Use to answer 'when did X pay' or to audit a disputed amount.",
  schema: z.object({
    circleId: circleIdArg,
    memberId: z.string().optional().describe("Only entries about this member"),
    limit: z.coerce.number().int().min(1).max(500).default(200).describe("Max entries"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async (args) => {
    await checkCircleAccess(args.circleId, "viewer");
    const { rows, entries } = await readLedger(getDb(), args.circleId);
    const reversed = new Set(
      entries.flatMap((e) => (e.kind === "reversal" ? [e.payload.targetSeq] : [])),
    );
    const list = entries
      .map((e, i) => ({
        ...e,
        recordedVia: rows[i]?.recordedVia ?? "app",
        recordedBy: rows[i]?.recordedBy ?? "",
        reversed: reversed.has(e.seq),
      }))
      .filter((e) => {
        if (!args.memberId) return true;
        const p = e.payload as unknown as Record<string, unknown>;
        return p.memberId === args.memberId || p.memberA === args.memberId || p.memberB === args.memberId;
      })
      .reverse()
      .slice(0, args.limit);
    return { total: entries.length, entries: list };
  },
});
