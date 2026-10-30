/**
 * The Kolo ledger: an append-only, hash-chained log per circle.
 *
 * Every entry commits to the one before it, so changing any past amount,
 * name, or date changes every hash after it. This module runs unchanged on
 * the server (to append) and in a member's browser (to verify), using only
 * Web Crypto, so nobody has to trust the organizer's server to check the books.
 */
import type { Cadence } from "./schedule";
import type { CurrencyCode } from "./money";

export const GENESIS_PREV_HASH = "0".repeat(64);
export const HASH_VERSION = "kolo:v1";

export interface GenesisPayload {
  circleId: string;
  name: string;
  currency: CurrencyCode;
  contributionMinor: number;
  cadence: Cadence;
  startDate: string;
  graceDays: number;
  /** Payout order at opening: members[0] collects round 1. */
  members: { id: string; name: string }[];
}

export interface ContributionPayload {
  memberId: string;
  round: number;
  amountMinor: number;
  method: "transfer" | "cash" | "other";
  signalId?: string;
  reference?: string;
  note?: string;
}

export interface PayoutPayload {
  memberId: string;
  round: number;
  amountMinor: number;
  reference?: string;
  note?: string;
}

export interface SwapPayload {
  roundA: number;
  roundB: number;
  memberA: string;
  memberB: string;
  /** How both members agreed, e.g. "Both confirmed in the WhatsApp group, 12 Nov". */
  consent: string;
}

export interface ReversalPayload {
  targetSeq: number;
  reason: string;
}

export interface ClosedPayload {
  reason: string;
}

export type EntryKindMap = {
  "circle.opened": GenesisPayload;
  contribution: ContributionPayload;
  payout: PayoutPayload;
  swap: SwapPayload;
  reversal: ReversalPayload;
  "circle.closed": ClosedPayload;
};

export type EntryKind = keyof EntryKindMap;

export const ENTRY_KINDS = [
  "circle.opened",
  "contribution",
  "payout",
  "swap",
  "reversal",
  "circle.closed",
] as const satisfies readonly EntryKind[];

export interface UnsealedEntry<K extends EntryKind = EntryKind> {
  seq: number;
  kind: K;
  payload: EntryKindMap[K];
  /** ISO 8601 UTC instant the entry was recorded. */
  recordedAt: string;
}

export interface LedgerEntry<K extends EntryKind = EntryKind>
  extends UnsealedEntry<K> {
  prevHash: string;
  hash: string;
}

export type AnyEntry = {
  [K in EntryKind]: LedgerEntry<K>;
}[EntryKind];

/**
 * Deterministic JSON: object keys sorted, undefined dropped, no whitespace.
 * Two machines serialising the same payload always produce the same bytes.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("Non-finite number in ledger payload");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function entryPreimage(entry: UnsealedEntry, prevHash: string): string {
  return [
    HASH_VERSION,
    String(entry.seq),
    prevHash,
    entry.kind,
    entry.recordedAt,
    canonicalJson(entry.payload),
  ].join("\n");
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function sealEntry<K extends EntryKind>(
  entry: UnsealedEntry<K>,
  prevHash: string,
): Promise<LedgerEntry<K>> {
  const hash = await sha256Hex(entryPreimage(entry, prevHash));
  return { ...entry, prevHash, hash };
}

export type VerifyResult =
  | { ok: true; count: number; headHash: string }
  | {
      ok: false;
      count: number;
      /** First sequence number where the chain stops matching. */
      brokenAt: number;
      reason: "sequence_gap" | "prev_hash_mismatch" | "hash_mismatch";
      expected: string;
      found: string;
    };

/**
 * Recompute every hash from the genesis entry forward. Entries must be sorted
 * by seq. Detects edits, deletions, insertions, and reordering.
 */
export async function verifyChain(
  entries: readonly LedgerEntry[],
): Promise<VerifyResult> {
  let prev = GENESIS_PREV_HASH;
  for (const [i, e] of entries.entries()) {
    if (e.seq !== i + 1) {
      return {
        ok: false,
        count: i,
        brokenAt: i + 1,
        reason: "sequence_gap",
        expected: String(i + 1),
        found: String(e.seq),
      };
    }
    if (e.prevHash !== prev) {
      return {
        ok: false,
        count: i,
        brokenAt: e.seq,
        reason: "prev_hash_mismatch",
        expected: prev,
        found: e.prevHash,
      };
    }
    const recomputed = await sha256Hex(entryPreimage(e, prev));
    if (recomputed !== e.hash) {
      return {
        ok: false,
        count: i,
        brokenAt: e.seq,
        reason: "hash_mismatch",
        expected: recomputed,
        found: e.hash,
      };
    }
    prev = e.hash;
  }
  return { ok: true, count: entries.length, headHash: prev };
}

/** Short, human-checkable form of a hash: "3f9a·c21e". */
export function sealOf(hash: string): string {
  return `${hash.slice(0, 4)}·${hash.slice(4, 8)}`;
}
