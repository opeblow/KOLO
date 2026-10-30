import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  checkCircleAccess,
  notFound,
  readLedger,
  readMembers,
} from "../server/lib/circles.js";
import { buildCircleView } from "../server/lib/view.js";

export default defineAction({
  description:
    "Full state of one circle: terms, members with what each has paid and received, every round's due date, recipient, collection and status, late payers, money the organizer should be holding, trust exposure, and whether the ledger verifies. Amounts are integer minor units (kobo/cents) in the circle currency.",
  schema: z.object({
    circleId: z.string().describe("Circle id from list-circles"),
  }),
  http: { method: "GET" },
  readOnly: true,
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "circle",
      to: `/circles/${encodeURIComponent(args.circleId)}`,
      params: { circleId: args.circleId },
    }),
    label: "Open circle",
  }),
  run: async ({ circleId }) => {
    await checkCircleAccess(circleId, "viewer");
    const db = getDb();
    const [circle] = await db
      .select()
      .from(schema.circles)
      .where(eq(schema.circles.id, circleId))
      .limit(1);
    if (!circle) notFound();

    const [members, { entries }, pending, nudges] = await Promise.all([
      readMembers(db, circleId),
      readLedger(db, circleId),
      db
        .select({ id: schema.paymentSignals.id })
        .from(schema.paymentSignals)
        .where(
          and(
            eq(schema.paymentSignals.circleId, circleId),
            eq(schema.paymentSignals.status, "pending"),
          ),
        )
        .limit(500),
      db
        .select({ memberId: schema.nudges.memberId, createdAt: schema.nudges.createdAt })
        .from(schema.nudges)
        .where(eq(schema.nudges.circleId, circleId))
        .orderBy(desc(schema.nudges.createdAt))
        .limit(500),
    ]);

    const lastNudges: Record<string, string> = {};
    for (const n of nudges) lastNudges[n.memberId] ??= n.createdAt;

    return buildCircleView(circle, members, entries, {
      includePrivate: true,
      pendingSignals: pending.length,
      lastNudges,
    });
  },
});
