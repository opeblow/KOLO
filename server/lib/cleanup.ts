import { and, eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";

/**
 * Remove a circle that never started, with its members, inbox, and shares.
 * Refuses (returns false) once a ledger exists: started circles are permanent.
 */
export async function discardDraftCircle(circleId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [circle] = await tx
      .select({ status: schema.circles.status, headSeq: schema.circles.headSeq })
      .from(schema.circles)
      .where(eq(schema.circles.id, circleId))
      .for("update");
    if (!circle || circle.status !== "draft" || circle.headSeq > 0) return false;
    await tx.delete(schema.nudges).where(eq(schema.nudges.circleId, circleId));
    await tx.delete(schema.paymentSignals).where(eq(schema.paymentSignals.circleId, circleId));
    await tx.delete(schema.members).where(eq(schema.members.circleId, circleId));
    await tx
      .delete(schema.circleShares)
      .where(and(eq(schema.circleShares.resourceId, circleId)));
    await tx.delete(schema.circles).where(eq(schema.circles.id, circleId));
    return true;
  });
}
