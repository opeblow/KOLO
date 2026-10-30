import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { CURRENCY_CODES, toMinor } from "../shared/money.js";
import { CADENCES, isCalendarDate } from "../shared/schedule.js";
import { getDb, schema } from "../server/db/index.js";
import { newToken, requireUser } from "../server/lib/circles.js";
import { memberInput } from "../server/lib/inputs.js";

export default defineAction({
  description:
    "Create a savings circle in draft with its members in payout order (first member collects round 1). Terms can be edited until activate-circle starts it. Use when the user describes a new ajo/esusu/tanda/chama/susu group or pastes its rules.",
  schema: z.object({
    name: z.string().trim().min(1).max(80).describe("Circle name, e.g. 'Yaba Market Ajo'"),
    currency: z.enum(CURRENCY_CODES).default("NGN").describe("ISO currency code"),
    contribution: z
      .number()
      .positive()
      .max(1e10)
      .describe("What each member pays per round, in major units (50000 means ₦50,000)"),
    cadence: z.enum(CADENCES).default("monthly").describe("How often a round falls due"),
    startDate: z
      .string()
      .refine(isCalendarDate, "Use YYYY-MM-DD")
      .describe("Due date of round 1 as YYYY-MM-DD"),
    graceDays: z
      .number()
      .int()
      .min(0)
      .max(30)
      .default(2)
      .describe("Days after a due date before a payment counts as late"),
    timezone: z.string().max(64).default("Africa/Lagos").describe("IANA timezone of the group"),
    members: z
      .array(memberInput)
      .min(2)
      .max(50)
      .describe("Members in payout order; the first collects round 1"),
  }),
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "circle",
      to: `/circles/${encodeURIComponent(result.id)}`,
      params: { circleId: result.id },
    }),
    label: `Open ${result.name}`,
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    try {
      new Intl.DateTimeFormat("en", { timeZone: args.timezone });
    } catch {
      fail(`Unknown timezone "${args.timezone}".`, { errorCode: "invalid_timezone" });
    }
    const names = args.members.map((m) => m.name.toLowerCase());
    const dupe = names.find((n, i) => names.indexOf(n) !== i);
    if (dupe) {
      fail(`Two members are both called "${dupe}". Add a surname or nickname so payments can't be confused.`, {
        errorCode: "duplicate_member_name",
      });
    }

    const id = crypto.randomUUID();
    const contributionMinor = toMinor(args.contribution, args.currency);
    await getDb().transaction(async (tx) => {
      await tx.insert(schema.circles).values({
        id,
        name: args.name,
        currency: args.currency,
        contributionMinor,
        cadence: args.cadence,
        startDate: args.startDate,
        graceDays: args.graceDays,
        timezone: args.timezone,
        status: "draft",
        publicToken: newToken(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerEmail,
        orgId,
        visibility: orgId ? "org" : "private",
      });
      await tx.insert(schema.members).values(
        args.members.map((m, i) => ({
          id: crypto.randomUUID(),
          circleId: id,
          name: m.name,
          phone: m.phone || null,
          aliases: JSON.stringify(m.aliases ?? []),
          position: i + 1,
          memberToken: newToken(),
          ownerEmail,
          orgId,
        })),
      );
    });

    return {
      id,
      name: args.name,
      status: "draft" as const,
      memberCount: args.members.length,
      potMinor: contributionMinor * args.members.length,
      message: `Created ${args.name} with ${args.members.length} members. It is a draft until activated.`,
      nextRequiredAction:
        "Review the payout order with the organizer, then call activate-circle to start it.",
    };
  },
});
