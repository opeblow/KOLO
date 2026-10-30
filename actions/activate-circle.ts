import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { sealOf } from "../shared/ledger.js";
import { schema } from "../server/db/index.js";
import {
  appendOne,
  readMembers,
  requireUser,
  viaFromCaller,
  withCircleLock,
} from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";
import { genesisFromDraft } from "../server/lib/view.js";

export default defineAction({
  description:
    "Start a draft circle. Writes the opening ledger entry that freezes the terms and payout order; after this, money can be recorded and members can verify the books from their link. Confirm the order with the organizer first.",
  schema: z.object({ circleId: circleIdArg }),
  run: async (args, ctx) => {
    const by = requireUser(ctx);
    return withCircleLock(args.circleId, "editor", async (locked) => {
      const { tx, circle } = locked;
      if (circle.status !== "draft")
        fail("This circle has already started.", { errorCode: "already_active", statusCode: 409 });
      const members = await readMembers(tx, circle.id);
      if (members.length < 2)
        fail("A circle needs at least two members.", { errorCode: "too_few_members", statusCode: 409 });
      const genesis = await appendOne(locked, { kind: "circle.opened", payload: genesisFromDraft(circle, members) }, { via: viaFromCaller(ctx), by });
      await tx
        .update(schema.circles)
        .set({ status: "active" })
        .where(eq(schema.circles.id, circle.id));
      return {
        id: circle.id,
        seq: genesis.seq,
        seal: sealOf(genesis.hash),
        message: `${circle.name} has started. Ledger seal ${sealOf(genesis.hash)}.`,
      };
    });
  },
});
