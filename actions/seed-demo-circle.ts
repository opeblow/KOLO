import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  appendEntries,
  newToken,
  readMembers,
  requireUser,
  withCircleLock,
} from "../server/lib/circles.js";
import { discardDraftCircle } from "../server/lib/cleanup.js";
import { ingestIntoCircle } from "../server/lib/ingest.js";
import { genesisFromDraft } from "../server/lib/view.js";
import { foldLedger, roundAt } from "../shared/circle-state.js";
import { addDays, todayIn } from "../shared/schedule.js";

const MEMBERS = [
  { name: "Ngozi Okafor", phone: "+2348030000001" },
  { name: "Tunde Adebayo", phone: "+2348030000002" },
  { name: "Aisha Mohammed", phone: "+2348030000003" },
  { name: "Chidi Eze", phone: "+2348030000004" },
  { name: "Emeka Okonkwo", phone: "+2348030000005" },
  { name: "Temitope Bello", phone: "+2348030000006" },
];
const CONTRIBUTION = 5_000_000; // ₦50,000

export default defineAction({
  description:
    "Create a sample circle with four weeks of real ledger history (three payouts made, round 4 blocked by two late payers, two bank alerts waiting in the inbox) so a new user can explore Kolo. Every entry goes through the normal rules and hash chain; entries are labelled as demo data.",
  schema: z.object({}),
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "circle",
      to: `/circles/${result.id}`,
      params: { circleId: result.id },
    }),
    label: "Open sample circle",
  }),
  run: async (_args, ctx) => {
    const by = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    const today = todayIn("Africa/Lagos");
    const id = crypto.randomUUID();
    // Round 4 fell due a week ago, so Emeka and Temitope are past the grace period.
    const startDate = addDays(today, -28);

    await getDb().transaction(async (tx) => {
      await tx.insert(schema.circles).values({
        id,
        name: "Yaba Traders' Ajo",
        currency: "NGN",
        contributionMinor: CONTRIBUTION,
        cadence: "weekly",
        startDate,
        graceDays: 2,
        timezone: "Africa/Lagos",
        status: "draft",
        publicToken: newToken(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerEmail: by,
        orgId,
        visibility: orgId ? "org" : "private",
      });
      await tx.insert(schema.members).values(
        MEMBERS.map((m, i) => ({
          id: crypto.randomUUID(),
          circleId: id,
          name: m.name,
          phone: m.phone,
          aliases: JSON.stringify(i === 1 ? ["ADEBAYO TUNDE O"] : []),
          position: i + 1,
          memberToken: newToken(),
          ownerEmail: by,
          orgId,
        })),
      );
    });

    const meta = { via: "demo", by };
    try {
      await withCircleLock(id, "editor", async (locked) => {
        const members = await readMembers(locked.tx, id);
        const ids = members.map((m) => m.id);
        const [ngozi, tunde, aisha, chidi] = ids as [
          string,
          string,
          string,
          string,
        ];
        await appendEntries(
          locked,
          [
            {
              kind: "circle.opened",
              payload: genesisFromDraft(locked.circle, members),
            },
          ],
          meta,
        );
        await locked.tx
          .update(schema.circles)
          .set({ status: "active" })
          .where(eq(schema.circles.id, id));
        locked.circle = { ...locked.circle, status: "active" };

        const pay = (
          memberId: string,
          round: number,
          method: "transfer" | "cash" = "transfer",
        ) => ({
          kind: "contribution" as const,
          payload: {
            memberId,
            round,
            amountMinor: CONTRIBUTION,
            method,
            note: "Sample data",
          },
        });
        for (const round of [1, 2, 3]) {
          await appendEntries(
            locked,
            ids.map((m, i) =>
              pay(m, round, i === 3 && round === 2 ? "cash" : "transfer"),
            ),
            meta,
          );
          const state = foldLedger(locked.entries);
          await appendEntries(
            locked,
            [
              {
                kind: "payout",
                payload: {
                  memberId: roundAt(state, round).recipientId,
                  round,
                  amountMinor: state.potMinor,
                  note: "Sample data",
                },
              },
            ],
            meta,
          );
        }
        // Round 4: Emeka and Temitope haven't paid. Aisha paid two weeks at once.
        await appendEntries(
          locked,
          [
            pay(ngozi, 4),
            pay(tunde, 4),
            pay(aisha, 4),
            pay(aisha, 5),
            pay(chidi, 4),
          ],
          meta,
        );

        await ingestIntoCircle(
          locked,
          {
            text: [
              `Acct: 0123***789\nAmt: NGN50,000.00 CR\nDesc: TRANSFER FROM OKONKWO EMEKA J\nAvail Bal: NGN350,000.00\nDate: ${today} 08:14`,
              `You have received ₦50,000.00 from MAMA TEMI PROVISIONS. Ref: 2611${today.replace(/-/g, "").slice(2)}0441 on ${today}`,
            ].join("\n\n"),
          },
          by,
        );
      });
    } catch (err) {
      // The ledger transaction rolled back; remove the draft shell too.
      await discardDraftCircle(id);
      throw err;
    }

    return {
      id,
      name: "Yaba Traders' Ajo",
      message:
        "Created Yaba Traders' Ajo: 6 members, ₦50,000 weekly, 3 payouts done, round 4 waiting on Emeka and Temitope, 2 bank alerts in the inbox.",
    };
  },
});
