import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { checkCircleAccess, requireUser } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description: "Record that a reminder was sent to a member, so the circle remembers who was nudged and when.",
  schema: z.object({
    circleId: circleIdArg,
    memberId: z.string().describe("Member id"),
    round: z.number().int().min(1).describe("Round the reminder was about"),
    channel: z.enum(["whatsapp", "sms", "copy"]).default("whatsapp").describe("How it was sent"),
    message: z.string().trim().min(1).max(2000).describe("The text that was sent"),
  }),
  parallelSafe: true,
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    await checkCircleAccess(args.circleId, "editor");
    const db = getDb();
    const [member] = await db
      .select({ id: schema.members.id, orgId: schema.members.orgId })
      .from(schema.members)
      .where(and(eq(schema.members.id, args.memberId), eq(schema.members.circleId, args.circleId)))
      .limit(1);
    if (!member) fail("Member not found.", { errorCode: "not_found", statusCode: 404 });
    const id = crypto.randomUUID();
    await db.insert(schema.nudges).values({
      id,
      circleId: args.circleId,
      memberId: args.memberId,
      round: args.round,
      channel: args.channel,
      message: args.message,
      ownerEmail,
      orgId: member.orgId,
    });
    return { id, message: "Reminder logged." };
  },
});
