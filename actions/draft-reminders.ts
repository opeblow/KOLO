import { defineAction, fail } from "@agent-native/core/action";
import { getAppProductionUrl } from "@agent-native/core/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { latePayments, roundAt, shortfall } from "../shared/circle-state.js";
import { sealOf } from "../shared/ledger.js";
import { formatMoney } from "../shared/money.js";
import { todayIn } from "../shared/schedule.js";
import { getDb, schema } from "../server/db/index.js";
import { checkCircleAccess, notFound, readLedger, readMembers } from "../server/lib/circles.js";
import { circleIdArg } from "../server/lib/inputs.js";
import {
  REMINDER_LANGUAGES,
  renderReminder,
  shortDate,
  whatsappLink,
} from "../server/lib/reminders.js";
import { stateFor } from "../server/lib/view.js";

export default defineAction({
  description:
    "Draft WhatsApp reminders for members who owe money, each with exact amounts from the ledger, a wa.me link that opens WhatsApp with the message filled in, the member's personal status link, and the current ledger seal. Nothing is sent: the organizer taps to send, then log-nudge records it. Languages: en, pcm (Nigerian Pidgin), es, fr, sw.",
  schema: z.object({
    circleId: circleIdArg,
    scope: z.enum(["late", "unpaid"]).default("late").describe("'late' = past grace period; 'unpaid' = everyone still owing for the current round"),
    language: z.enum(REMINDER_LANGUAGES).default("en").describe("Message language"),
    origin: z.string().url().optional().describe("App origin for links; the UI passes window.location.origin"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async (args) => {
    await checkCircleAccess(args.circleId, "viewer");
    const db = getDb();
    const [circle] = await db.select().from(schema.circles).where(eq(schema.circles.id, args.circleId)).limit(1);
    if (!circle) notFound();
    if (circle.status !== "active")
      fail("Reminders are for circles that are running.", { errorCode: "circle_not_active", statusCode: 409 });
    const [members, { entries }, nudges] = await Promise.all([
      readMembers(db, circle.id),
      readLedger(db, circle.id),
      db
        .select({ memberId: schema.nudges.memberId, createdAt: schema.nudges.createdAt })
        .from(schema.nudges)
        .where(eq(schema.nudges.circleId, circle.id))
        .orderBy(desc(schema.nudges.createdAt))
        .limit(500),
    ]);
    const state = stateFor(circle, members, entries)!;
    const today = todayIn(circle.timezone);
    const origin = (args.origin ?? getAppProductionUrl(undefined, { fallback: "http://localhost:8080" })).replace(/\/$/, "");

    type Owed = { memberId: string; round: number; owedMinor: number; dueDate: string; daysLate: number };
    let owed: Owed[];
    if (args.scope === "late") {
      owed = latePayments(state, today);
    } else {
      const r = state.nextPayoutRound;
      owed = r
        ? shortfall(state, r).map((s) => ({
            memberId: s.memberId,
            round: r,
            owedMinor: s.owedMinor,
            dueDate: roundAt(state, r).dueDate,
            daysLate: 0,
          }))
        : [];
    }

    // One message per member, about their oldest unpaid round.
    const byMember = new Map<string, Owed>();
    for (const o of owed) if (!byMember.has(o.memberId)) byMember.set(o.memberId, o);

    const lastNudge = new Map<string, string>();
    for (const n of nudges) if (!lastNudge.has(n.memberId)) lastNudge.set(n.memberId, n.createdAt);

    const drafts = [...byMember.values()].map((o) => {
      const member = members.find((m) => m.id === o.memberId)!;
      const round = roundAt(state, o.round);
      const totalOwed = owed.filter((x) => x.memberId === o.memberId).reduce((s, x) => s + x.owedMinor, 0);
      const message = renderReminder(args.language, {
        first: member.name.split(/\s+/)[0] ?? member.name,
        circle: circle.name,
        amount: formatMoney(totalOwed, state.terms.currency),
        round: o.round,
        date: shortDate(o.dueDate, args.language),
        recipient: state.members[round.recipientId]?.name.split(/\s+/)[0] ?? "the next member",
        link: `${origin}/m/${member.memberToken}`,
        seal: sealOf(circle.headHash),
        late: o.daysLate > 0,
      });
      return {
        memberId: member.id,
        name: member.name,
        round: o.round,
        owedMinor: totalOwed,
        daysLate: o.daysLate,
        phone: member.phone,
        message,
        whatsappUrl: whatsappLink(member.phone, message),
        lastNudgedAt: lastNudge.get(member.id) ?? null,
      };
    });

    return {
      id: circle.id,
      drafts,
      message: drafts.length
        ? `${drafts.length} reminder(s) drafted. The organizer sends them from WhatsApp.`
        : args.scope === "late"
          ? "Nobody is late."
          : "Everyone has paid for the current round.",
    };
  },
});
