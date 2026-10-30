import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { checkCircleAccess } from "../server/lib/circles.js";
import { discardDraftCircle } from "../server/lib/cleanup.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description:
    "Delete a circle that is still a draft. Started circles can't be deleted: members rely on their ledger, so close them instead once every round pays out.",
  schema: z.object({ circleId: circleIdArg }),
  run: async ({ circleId }) => {
    await checkCircleAccess(circleId, "owner");
    const deleted = await discardDraftCircle(circleId);
    if (!deleted)
      fail("Only drafts can be deleted. A started circle's ledger is permanent.", {
        errorCode: "circle_started",
        statusCode: 409,
      });
    return { id: circleId, message: "Draft deleted." };
  },
});
