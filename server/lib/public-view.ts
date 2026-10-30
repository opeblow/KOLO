/**
 * What members see without an account. They get the full ledger (so their
 * browser can re-verify every hash) and display names, but never phone
 * numbers, bank aliases, the organizer's email, or anyone else's token.
 */
import { eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import { readLedger, readMembers, type CircleRow } from "./circles.js";

const TOKEN_RE = /^[0-9a-f]{32}$/;

export function isToken(value: string | undefined): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

export async function publicCircleBundle(circle: CircleRow) {
  const db = getDb();
  const [members, { entries }] = await Promise.all([
    readMembers(db, circle.id),
    readLedger(db, circle.id),
  ]);
  return {
    circle: {
      name: circle.name,
      currency: circle.currency,
      contributionMinor: circle.contributionMinor,
      cadence: circle.cadence,
      startDate: circle.startDate,
      graceDays: circle.graceDays,
      timezone: circle.timezone,
      status: circle.status,
      headSeq: circle.headSeq,
      headHash: circle.headHash,
    },
    members: members.map((m) => ({ id: m.id, name: m.name })),
    entries,
  };
}

export async function circleByPublicToken(token: string) {
  const [circle] = await getDb()
    .select()
    .from(schema.circles)
    .where(eq(schema.circles.publicToken, token))
    .limit(1);
  return circle ?? null;
}

export async function memberByToken(token: string) {
  const [member] = await getDb()
    .select()
    .from(schema.members)
    .where(eq(schema.members.memberToken, token))
    .limit(1);
  if (!member) return null;
  const [circle] = await getDb()
    .select()
    .from(schema.circles)
    .where(eq(schema.circles.id, member.circleId))
    .limit(1);
  return circle ? { member, circle } : null;
}
