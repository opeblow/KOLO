/**
 * The only path that writes to a circle's ledger.
 *
 * withCircleLock() checks access, opens a transaction, locks the circle row
 * (so concurrent writers to one circle serialize while other circles proceed
 * in parallel), re-reads and re-verifies the chain, folds state, and hands
 * the caller a snapshot. appendEntries() seals new entries onto the head and
 * advances the cached head in the same transaction.
 */
import { fail, type ActionRunContext } from "@agent-native/core/action";
import { assertAccess } from "@agent-native/core/sharing";
import { asc, eq } from "drizzle-orm";

import { foldLedger, type CircleState, type Violation } from "../../shared/circle-state.js";
import {
  GENESIS_PREV_HASH,
  sealEntry,
  verifyChain,
  type AnyEntry,
  type EntryKind,
  type EntryKindMap,
} from "../../shared/ledger.js";
import { getDb, schema } from "../db/index.js";

export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type CircleRow = typeof schema.circles.$inferSelect;
export type MemberRow = typeof schema.members.$inferSelect;

export function requireUser(ctx: ActionRunContext | undefined): string {
  return ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401, errorCode: "unauthenticated" });
}

/** Turns the framework's caller into the label shown on each ledger entry. */
export function viaFromCaller(ctx: ActionRunContext | undefined): string {
  switch (ctx?.caller) {
    case "tool":
      return "agent";
    case "automation":
      return "automation";
    case "cli":
      return "cli";
    case "mcp":
    case "mcp-widget":
    case "mcp-widget-write":
    case "webmcp":
      return "mcp";
    case "a2a":
      return "a2a";
    default:
      return "app";
  }
}

export function failRule(violation: Violation): never {
  fail(violation.message, {
    errorCode: violation.code,
    statusCode: 409,
    ...(violation.details ? { details: violation.details } : {}),
  });
}

export function notFound(what = "Circle"): never {
  fail(`${what} not found.`, { errorCode: "not_found", statusCode: 404 });
}

type Role = "viewer" | "editor" | "admin" | "owner";

/** Access check that turns "no access" into a 404 so ids don't leak. */
export async function checkCircleAccess(circleId: string, role: Role) {
  try {
    await assertAccess("circle", circleId, role);
  } catch (err) {
    if (err instanceof Error && /forbidden|not found|access/i.test(err.message)) {
      notFound();
    }
    throw err;
  }
}

export function parseEntries(
  rows: { seq: number; kind: string; payload: string; recordedAt: string; prevHash: string; hash: string }[],
): AnyEntry[] {
  return rows.map(
    (r) =>
      ({
        seq: r.seq,
        kind: r.kind as EntryKind,
        payload: JSON.parse(r.payload),
        recordedAt: r.recordedAt,
        prevHash: r.prevHash,
        hash: r.hash,
      }) as AnyEntry,
  );
}

export async function readLedger(db: Db | Tx, circleId: string) {
  const l = schema.ledgerEntries;
  const rows = await db
    .select({
      seq: l.seq,
      kind: l.kind,
      payload: l.payload,
      recordedAt: l.recordedAt,
      prevHash: l.prevHash,
      hash: l.hash,
      recordedVia: l.recordedVia,
      recordedBy: l.recordedBy,
    })
    .from(l)
    .where(eq(l.circleId, circleId))
    .orderBy(asc(l.seq))
    // A circle tops out around 50 members × 50 rounds of contributions.
    .limit(20_000);
  return { rows, entries: parseEntries(rows) };
}

export async function readMembers(db: Db | Tx, circleId: string) {
  const m = schema.members;
  return db
    .select()
    .from(m)
    .where(eq(m.circleId, circleId))
    .orderBy(asc(m.position))
    .limit(200);
}

export interface Locked {
  tx: Tx;
  circle: CircleRow;
  entries: AnyEntry[];
  state: CircleState | null;
}

export async function withCircleLock<T>(
  circleId: string,
  role: Role,
  fn: (locked: Locked) => Promise<T>,
): Promise<T> {
  await checkCircleAccess(circleId, role);
  return getDb().transaction(async (tx) => {
    const [circle] = await tx
      .select()
      .from(schema.circles)
      .where(eq(schema.circles.id, circleId))
      .for("update");
    if (!circle) notFound();
    const { entries } = await readLedger(tx, circleId);

    // Refuse to build on a chain that doesn't check out. A broken chain means
    // someone edited rows outside the app; appending would bury the evidence.
    if (entries.length) {
      const verified = await verifyChain(entries);
      if (!verified.ok || verified.headHash !== circle.headHash) {
        fail(
          "This circle's ledger failed verification, so new entries are blocked until it is investigated.",
          {
            errorCode: "ledger_integrity",
            statusCode: 409,
            details: verified.ok ? { reason: "head_mismatch" } : verified,
          },
        );
      }
    }
    const state = entries.length ? foldLedger(entries) : null;
    return fn({ tx, circle, entries, state });
  });
}

export function requireActive(locked: Locked): CircleState {
  if (locked.circle.status === "draft" || !locked.state) {
    fail("Start the circle before recording money.", {
      errorCode: "circle_not_active",
      statusCode: 409,
    });
  }
  if (locked.circle.status === "closed") {
    fail("This circle is closed.", { errorCode: "circle_closed", statusCode: 409 });
  }
  return locked.state;
}

export async function appendEntries(
  locked: Locked,
  items: { [K in EntryKind]: { kind: K; payload: EntryKindMap[K] } }[EntryKind][],
  meta: { via: string; by: string },
): Promise<AnyEntry[]> {
  const { tx, circle } = locked;
  let prev = circle.headHash || GENESIS_PREV_HASH;
  let seq = circle.headSeq;
  const sealed: AnyEntry[] = [];
  // One timestamp per batch keeps a split payment's entries together.
  const recordedAt = new Date().toISOString();
  for (const item of items) {
    seq += 1;
    const entry = (await sealEntry(
      { seq, kind: item.kind, payload: item.payload, recordedAt } as never,
      prev,
    )) as AnyEntry;
    await tx.insert(schema.ledgerEntries).values({
      id: crypto.randomUUID(),
      circleId: circle.id,
      seq: entry.seq,
      kind: entry.kind,
      payload: JSON.stringify(entry.payload),
      recordedAt: entry.recordedAt,
      prevHash: entry.prevHash,
      hash: entry.hash,
      recordedVia: meta.via,
      recordedBy: meta.by,
      ownerEmail: circle.ownerEmail,
      orgId: circle.orgId,
    });
    sealed.push(entry);
    prev = entry.hash;
  }
  await tx
    .update(schema.circles)
    .set({ headSeq: seq, headHash: prev, updatedAt: recordedAt })
    .where(eq(schema.circles.id, circle.id));
  locked.circle = { ...circle, headSeq: seq, headHash: prev };
  locked.entries = [...locked.entries, ...sealed];
  locked.state = foldLedger(locked.entries);
  return sealed;
}

/** Append a single entry and return it sealed. */
export async function appendOne(
  locked: Locked,
  item: Parameters<typeof appendEntries>[1][number],
  meta: { via: string; by: string },
): Promise<AnyEntry> {
  const [entry] = await appendEntries(locked, [item], meta);
  if (!entry) throw new Error("Ledger append returned no entry");
  return entry;
}

export function parseAliases(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function newToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
