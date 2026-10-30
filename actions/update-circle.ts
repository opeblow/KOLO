import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { isCurrency, toMinor, type CurrencyCode } from "../shared/money.js";
import { CADENCES, isCalendarDate } from "../shared/schedule.js";
import { schema } from "../server/db/index.js";
import { withCircleLock } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";

export default defineAction({
  description:
    "Edit a circle. The name and grace days can change any time; contribution, cadence, and start date only while it is a draft, because activation freezes them in the ledger.",
  schema: z.object({
    circleId: circleIdArg,
    name: z.string().trim().min(1).max(80).optional().describe("New circle name"),
    contribution: z.number().positive().max(1e10).optional().describe("Per-member contribution in major units"),
    cadence: z.enum(CADENCES).optional().describe("weekly, biweekly, or monthly"),
    startDate: z.string().refine(isCalendarDate, "Use YYYY-MM-DD").optional().describe("Round 1 due date, YYYY-MM-DD"),
    graceDays: z.number().int().min(0).max(30).optional().describe("Days before a payment counts as late"),
  }),
  run: async (args) =>
    withCircleLock(args.circleId, "editor", async ({ tx, circle }) => {
      const frozen = ["contribution", "cadence", "startDate"].filter(
        (k) => args[k as keyof typeof args] !== undefined,
      );
      if (frozen.length && circle.status !== "draft") {
        fail(`${frozen.join(", ")} can't change after the circle starts; members agreed to those terms.`, {
          errorCode: "terms_frozen",
          statusCode: 409,
        });
      }
      const currency = (isCurrency(circle.currency) ? circle.currency : "NGN") as CurrencyCode;
      const patch = {
        ...(args.name ? { name: args.name } : {}),
        ...(args.contribution !== undefined
          ? { contributionMinor: toMinor(args.contribution, currency) }
          : {}),
        ...(args.cadence ? { cadence: args.cadence } : {}),
        ...(args.startDate ? { startDate: args.startDate } : {}),
        ...(args.graceDays !== undefined ? { graceDays: args.graceDays } : {}),
        updatedAt: new Date().toISOString(),
      };
      await tx.update(schema.circles).set(patch).where(eq(schema.circles.id, circle.id));
      return { id: circle.id, message: "Circle updated." };
    }),
});
