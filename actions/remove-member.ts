import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { schema } from "../server/db/index.js";
import { readMembers, withCircleLock } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description: "Remove a member from a draft circle. Started circles keep every member; use swap-turns to change the order instead.",
  schema: z.object({
    circleId: circleIdArg,
    memberId: z.string().describe("Member id from get-circle"),
  }),
  run: async (args) =>
    withCircleLock(args.circleId, "editor", async ({ tx, circle }) => {
      if (circle.status !== "draft")
        fail("Members can't leave a circle that has started; the ledger already counts on them.", {
          errorCode: "circle_started",
          statusCode: 409,
        });
      const m = schema.members;
      const deleted = await tx
        .delete(m)
        .where(and(eq(m.id, args.memberId), eq(m.circleId, circle.id)))
        .returning({ id: m.id, name: m.name });
      if (!deleted.length) fail("Member not found.", { errorCode: "not_found", statusCode: 404 });
      // Close the gap so positions stay 1..N.
      const rest = await readMembers(tx, circle.id);
      for (const [i, row] of rest.entries()) {
        if (row.position !== i + 1)
          await tx.update(m).set({ position: i + 1 }).where(eq(m.id, row.id));
      }
      return { id: args.memberId, message: `Removed ${deleted[0]?.name ?? "member"}.` };
    }),
});
