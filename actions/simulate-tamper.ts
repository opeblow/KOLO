import { defineAction, fail } from "@agent-native/core/action";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { checkCircleAccess } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

/**
 * DEVELOPMENT ONLY. Plays a dishonest database administrator: switches off
 * the append-only trigger, quietly shrinks one recorded contribution, and
 * switches the trigger back on. Exists so the demo can show that the hash
 * chain catches what a database permission can't. Never available in
 * production, and hidden from the agent.
 */
export default defineAction({
  description: "Development only: simulate a malicious direct edit to one ledger entry to demonstrate tamper detection.",
  schema: z.object({ circleId: circleIdArg }),
  agentTool: false,
  run: async ({ circleId }) => {
    if (process.env.NODE_ENV === "production")
      fail("Tamper simulation is disabled in production.", { errorCode: "forbidden", statusCode: 403 });
    await checkCircleAccess(circleId, "owner");
    return getDb().transaction(async (tx) => {
      const [target] = await tx
        .select({ id: schema.ledgerEntries.id, seq: schema.ledgerEntries.seq, payload: schema.ledgerEntries.payload })
        .from(schema.ledgerEntries)
        .where(and(eq(schema.ledgerEntries.circleId, circleId), eq(schema.ledgerEntries.kind, "contribution")))
        .orderBy(asc(schema.ledgerEntries.seq))
        .limit(1);
      if (!target) fail("No contribution to tamper with.", { errorCode: "not_found", statusCode: 404 });
      const payload = JSON.parse(target.payload) as { amountMinor: number };
      const forged = JSON.stringify({ ...payload, amountMinor: Math.round(payload.amountMinor / 10) });
      await tx.execute(sql`ALTER TABLE ledger_entries DISABLE TRIGGER ledger_entries_append_only`);
      await tx.execute(sql`UPDATE ledger_entries SET payload = ${forged} WHERE id = ${target.id}`);
      await tx.execute(sql`ALTER TABLE ledger_entries ENABLE TRIGGER ledger_entries_append_only`);
      return {
        id: circleId,
        seq: target.seq,
        message: `Entry #${target.seq} was edited directly in the database (amount cut to a tenth). Verification should now fail at #${target.seq}.`,
      };
    });
  },
});
