import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { isCalendarDate } from "../shared/schedule.js";
import { requireUser, withCircleLock } from "../server/lib/circles.js";
import { ingestIntoCircle } from "../server/lib/ingest.js";
import { circleIdArg } from "../server/lib/inputs.js";

const structuredAlert = z.object({
  raw: z.string().trim().min(3).max(2000).describe("The alert text exactly as received"),
  amount: z.number().positive().optional().describe("Amount in major units if you read it yourself"),
  senderName: z.string().trim().min(2).max(80).optional().describe("Sender name if you read it yourself"),
  occurredOn: z.string().refine(isCalendarDate, "Use YYYY-MM-DD").optional().describe("Payment date, YYYY-MM-DD"),
  reference: z.string().trim().max(60).optional().describe("Bank reference, if any"),
});

export default defineAction({
  description:
    "Add pasted bank alerts / payment SMS to a circle's payment inbox. Each alert is parsed, de-duplicated (the same alert or bank reference twice is refused), and matched to a member with a confidence score and reasons. Nothing is recorded in the ledger until confirmed. Pass `text` with the raw paste, or `alerts` with fields you already read. When a result lists missing fields, read that alert yourself and call amend-payment.",
  schema: z
    .object({
      circleId: circleIdArg,
      text: z.string().max(50_000).optional().describe("Raw pasted alerts; separate alerts with a blank line"),
      alerts: z.array(structuredAlert).max(100).optional().describe("Alerts with fields you extracted"),
    })
    .refine((a) => a.text?.trim() || a.alerts?.length, "Provide text or alerts"),
  run: async (args, ctx) => {
    const by = requireUser(ctx);
    return withCircleLock(args.circleId, "editor", (locked) => ingestIntoCircle(locked, args, by));
  },
});
