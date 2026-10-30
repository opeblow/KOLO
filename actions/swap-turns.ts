import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { checkSwap, roundAt } from "../shared/circle-state.js";
import { sealOf } from "../shared/ledger.js";
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
  description:
    "Swap two members' payout turns, e.g. someone with an emergency trades with a later member. Both rounds must be unpaid and you must record how both members agreed. Never invent consent; ask the organizer if it isn't stated.",
  schema: z.object({
    circleId: circleIdArg,
    roundA: z.number().int().min(1).describe("First round"),
    roundB: z.number().int().min(1).describe("Second round"),
    consent: z
      .string()
      .trim()
      .min(8)
      .max(300)
      .describe("How both members agreed, e.g. 'Both confirmed in the group chat on 12 Nov'"),
  }),
  run: async (args, ctx) => {
    const by = requireUser(ctx);
    return withCircleLock(args.circleId, "editor", async (locked) => {
      const state = requireActive(locked);
      const violation = checkSwap(state, args);
      if (violation) failRule(violation);
      const memberA = roundAt(state, args.roundA).recipientId;
      const memberB = roundAt(state, args.roundB).recipientId;
      const entry = await appendOne(locked, { kind: "swap", payload: { roundA: args.roundA, roundB: args.roundB, memberA, memberB, consent: args.consent } }, { via: viaFromCaller(ctx), by });
      return {
        id: locked.circle.id,
        ledgerSeq: entry.seq,
        seal: sealOf(entry.hash),
        message: `${state.members[memberA]?.name} now collects in round ${args.roundB}; ${state.members[memberB]?.name} in round ${args.roundA}.`,
      };
    });
  },
});
