import { defineAction } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { sealOf } from "../shared/ledger.js";
import { getDb, schema } from "../server/db/index.js";
import { checkCircleAccess } from "../server/lib/circles.js";

export default defineAction({
  description:
    "Read what the user is looking at right now: the view, the open circle and tab, and a short summary of that circle. Basic navigation is already in <current-screen>; call this for a fresh read before acting on 'this circle' or 'this payment'.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async () => {
    const navigation = (await readAppState("navigation")) as
      | { view?: string; circleId?: string; tab?: string; signalId?: string }
      | null;
    if (!navigation) return "No application state found. Is the app open?";

    const screen: Record<string, unknown> = { navigation };
    const canSee = navigation.circleId
      ? await checkCircleAccess(navigation.circleId, "viewer").then(
          () => true,
          () => false,
        )
      : false;
    if (navigation.circleId && canSee) {
      const [circle] = await getDb()
        .select({
          id: schema.circles.id,
          name: schema.circles.name,
          status: schema.circles.status,
          currency: schema.circles.currency,
          headSeq: schema.circles.headSeq,
          headHash: schema.circles.headHash,
        })
        .from(schema.circles)
        .where(eq(schema.circles.id, navigation.circleId))
        .limit(1);
      if (circle) {
        screen.circle = {
          ...circle,
          seal: sealOf(circle.headHash),
          hint: "Call get-circle for balances, rounds, and late payers.",
        };
      }
    }
    return screen;
  },
});
