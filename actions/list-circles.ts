import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { accessFilter } from "@agent-native/core/sharing";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { latePayments } from "../shared/circle-state.js";
import { todayIn } from "../shared/schedule.js";
import { getDb, schema } from "../server/db/index.js";
import { parseEntries } from "../server/lib/circles.js";
import { stateFor } from "../server/lib/view.js";

export default defineAction({
  description:
    "List the savings circles the user runs or can see, with progress, money held, late payers, and unmatched payments for each.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  link: () => ({
    url: buildDeepLink({ view: "circles", to: "/circles" }),
    label: "Open circles",
  }),
  run: async () => {
    const db = getDb();
    const { circles, circleShares, members, ledgerEntries, paymentSignals } = schema;
    const rows = await db
      .select()
      .from(circles)
      .where(accessFilter(circles, circleShares))
      .orderBy(desc(circles.updatedAt))
      .limit(50);
    if (!rows.length) return { circles: [] };
    const ids = rows.map((r) => r.id);

    const [memberRows, entryRows, pending] = await Promise.all([
      db.select().from(members).where(inArray(members.circleId, ids)).limit(5000),
      db
        .select({
          circleId: ledgerEntries.circleId,
          seq: ledgerEntries.seq,
          kind: ledgerEntries.kind,
          payload: ledgerEntries.payload,
          recordedAt: ledgerEntries.recordedAt,
          prevHash: ledgerEntries.prevHash,
          hash: ledgerEntries.hash,
        })
        .from(ledgerEntries)
        .where(inArray(ledgerEntries.circleId, ids))
        .orderBy(ledgerEntries.seq)
        .limit(100_000),
      db
        .select({ circleId: paymentSignals.circleId })
        .from(paymentSignals)
        .where(and(inArray(paymentSignals.circleId, ids), eq(paymentSignals.status, "pending")))
        .limit(5000),
    ]);

    return {
      circles: rows.map((c) => {
        const ms = memberRows
          .filter((m) => m.circleId === c.id)
          .sort((a, b) => a.position - b.position);
        const entries = parseEntries(entryRows.filter((e) => e.circleId === c.id));
        const state = stateFor(c, ms, entries);
        const today = todayIn(c.timezone);
        const next = state?.nextPayoutRound ? state.rounds[state.nextPayoutRound - 1] : null;
        const late = state && entries.length ? latePayments(state, today) : [];
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          currency: c.currency,
          cadence: c.cadence,
          contributionMinor: c.contributionMinor,
          memberCount: ms.length,
          memberNames: ms.slice(0, 8).map((m) => m.name),
          potMinor: c.contributionMinor * ms.length,
          heldMinor: entries.length ? (state?.heldMinor ?? 0) : 0,
          roundsPaid: state?.rounds.filter((r) => r.payout).length ?? 0,
          currentRound: state?.nextPayoutRound ?? null,
          currentRecipient: next ? (state?.members[next.recipientId]?.name ?? null) : null,
          currentDueDate: next?.dueDate ?? null,
          currentCollectedMinor: entries.length ? (next?.collectedMinor ?? 0) : 0,
          latePayers: new Set(late.map((l) => l.memberId)).size,
          pendingSignals: pending.filter((p) => p.circleId === c.id).length,
          seal: c.headHash.slice(0, 4) + "·" + c.headHash.slice(4, 8),
          updatedAt: c.updatedAt,
        };
      }),
    };
  },
});
