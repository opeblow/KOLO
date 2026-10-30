import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { schema } from "../server/db/index.js";
import {
  newToken,
  parseAliases,
  readMembers,
  requireUser,
  withCircleLock,
} from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description:
    "Add a member to a draft circle, or update any member's phone and bank-name aliases. Adding an alias teaches payment matching that, say, 'NWOSU C. ENTERPRISES' is Chioma. Names can only change while the circle is a draft.",
  schema: z.object({
    circleId: circleIdArg,
    memberId: z.string().optional().describe("Omit to add a new member"),
    name: z.string().trim().min(1).max(80).optional().describe("Member name (required when adding)"),
    phone: z.string().trim().max(24).nullable().optional().describe("WhatsApp number, e.g. +2348031234567; null clears it"),
    addAliases: z.array(z.string().trim().min(2).max(80)).max(10).optional().describe("Bank names to add"),
    removeAliases: z.array(z.string()).max(10).optional().describe("Bank names to forget"),
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    return withCircleLock(args.circleId, "editor", async ({ tx, circle }) => {
      const m = schema.members;
      if (!args.memberId) {
        if (circle.status !== "draft")
          fail("Members can only join before the circle starts. Start a new circle for newcomers.", {
            errorCode: "circle_started",
            statusCode: 409,
          });
        if (!args.name) fail("A new member needs a name.", { errorCode: "name_required" });
        const existing = await readMembers(tx, circle.id);
        if (existing.length >= 50) fail("A circle can have at most 50 members.", { errorCode: "too_many_members" });
        if (existing.some((e) => e.name.toLowerCase() === args.name!.toLowerCase()))
          fail(`There is already a member called ${args.name}.`, { errorCode: "duplicate_member_name", statusCode: 409 });
        const id = crypto.randomUUID();
        await tx.insert(m).values({
          id,
          circleId: circle.id,
          name: args.name,
          phone: args.phone || null,
          aliases: JSON.stringify(args.addAliases ?? []),
          position: existing.length + 1,
          memberToken: newToken(),
          ownerEmail,
          orgId: circle.orgId,
        });
        return { id, message: `Added ${args.name} as member ${existing.length + 1}.` };
      }

      const [member] = await tx
        .select()
        .from(m)
        .where(and(eq(m.id, args.memberId), eq(m.circleId, circle.id)))
        .limit(1);
      if (!member) fail("Member not found.", { errorCode: "not_found", statusCode: 404 });
      if (args.name && args.name !== member.name && circle.status !== "draft")
        fail("Names are recorded in the ledger once a circle starts, so they can't change.", {
          errorCode: "terms_frozen",
          statusCode: 409,
        });
      const remove = new Set((args.removeAliases ?? []).map((a) => a.toLowerCase()));
      const aliases = [
        ...new Set([...parseAliases(member.aliases), ...(args.addAliases ?? [])]),
      ].filter((a) => !remove.has(a.toLowerCase()));
      await tx
        .update(m)
        .set({
          ...(args.name ? { name: args.name } : {}),
          ...(args.phone !== undefined ? { phone: args.phone || null } : {}),
          aliases: JSON.stringify(aliases.slice(0, 20)),
        })
        .where(eq(m.id, member.id));
      return { id: member.id, aliases, message: `Updated ${args.name ?? member.name}.` };
    });
  },
});
