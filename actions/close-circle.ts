import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { checkClose } from "../shared/circle-state.js";
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
  description: "Close a circle after every round has paid out. The final seal is what members keep as proof the books balanced.",
  schema: z.object({
    circleId: circleIdArg,
    reason: z.string().trim().min(3).max(200).default("All rounds paid out").describe("Closing note"),
  }),
  run: async (args, ctx) => {
    const by = requireUser(ctx);
    return withCircleLock(args.circleId, "editor", async (locked) => {
      const state = requireActive(locked);
      const violation = checkClose(state);
      if (violation) failRule(violation);
      const entry = await appendOne(locked, { kind: "circle.closed", payload: { reason: args.reason } }, { via: viaFromCaller(ctx), by });
      await locked.tx.update(schema.circles).set({ status: "closed" }).where(eq(schema.circles.id, locked.circle.id));
      return {
        id: locked.circle.id,
        seal: sealOf(entry.hash),
        message: `${locked.circle.name} is closed. Final seal ${sealOf(entry.hash)}.`,
      };
    });
  },
});
