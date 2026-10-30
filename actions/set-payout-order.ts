import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { schema } from "../server/db/index.js";
import { readMembers, withCircleLock } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

/** Unbiased Fisher–Yates with crypto randomness (no Math.random). */
function fairShuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x1_0000_0000 / (i + 1)) * (i + 1);
    let draw = 0;
    // Rejection sampling removes modulo bias.
    do {
      crypto.getRandomValues(buf);
      draw = buf[0] ?? 0;
    } while (draw >= limit);
    const j = draw % (i + 1);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

export default defineAction({
  description:
    "Set who collects in which round before a circle starts. Pass memberIds in the new order, or method 'draw' for a fair random draw (cryptographically random, like drawing lots).",
  schema: z.object({
    circleId: circleIdArg,
    method: z.enum(["manual", "draw"]).default("manual").describe("'manual' uses memberIds; 'draw' shuffles fairly"),
    memberIds: z.array(z.string()).optional().describe("Every member id, in payout order (manual only)"),
  }),
  run: async (args) =>
    withCircleLock(args.circleId, "editor", async ({ tx, circle }) => {
      if (circle.status !== "draft")
        fail("The order is in the ledger now. Use swap-turns with both members' consent.", {
          errorCode: "circle_started",
          statusCode: 409,
        });
      const members = await readMembers(tx, circle.id);
      let order: string[];
      if (args.method === "draw") {
        order = fairShuffle(members.map((m) => m.id));
      } else {
        const ids = args.memberIds ?? [];
        const known = new Set(members.map((m) => m.id));
        if (ids.length !== members.length || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id)))
          fail("memberIds must list every member exactly once.", { errorCode: "invalid_order" });
        order = ids;
      }
      for (const [i, id] of order.entries()) {
        await tx.update(schema.members).set({ position: i + 1 }).where(eq(schema.members.id, id));
      }
      const names = order.map((id) => members.find((m) => m.id === id)!.name);
      return {
        id: circle.id,
        order: names,
        message:
          args.method === "draw"
            ? `Drew lots: ${names.map((n, i) => `${i + 1}. ${n}`).join(", ")}.`
            : "Payout order saved.",
      };
    }),
});
