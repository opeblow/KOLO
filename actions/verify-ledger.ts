import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { sealOf, verifyChain } from "../shared/ledger.js";
import { getDb, schema } from "../server/db/index.js";
import { checkCircleAccess, notFound, readLedger } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description:
    "Recompute every hash in a circle's ledger from the first entry and report whether the books are intact. A break names the first entry that no longer matches, which means someone changed data outside Kolo.",
  schema: z.object({ circleId: circleIdArg }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ circleId }) => {
    await checkCircleAccess(circleId, "viewer");
    const db = getDb();
    const [circle] = await db
      .select({ headHash: schema.circles.headHash, headSeq: schema.circles.headSeq })
      .from(schema.circles)
      .where(eq(schema.circles.id, circleId))
      .limit(1);
    if (!circle) notFound();
    const { entries } = await readLedger(db, circleId);
    const result = await verifyChain(entries);
    const headMatches = result.ok && result.headHash === circle.headHash;
    return {
      ...result,
      headMatches,
      seal: sealOf(circle.headHash),
      message: !result.ok
        ? `Ledger broken at entry #${result.brokenAt} (${result.reason.replace(/_/g, " ")}).`
        : headMatches
          ? `All ${result.count} entries verify. Seal ${sealOf(result.headHash)}.`
          : "Entries verify, but the recorded head doesn't match: the newest entries may have been deleted.",
    };
  },
});
