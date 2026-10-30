import { sql } from "drizzle-orm";
import { bigint, integer, pgTable, text } from "drizzle-orm/pg-core";
import {
  createSharesTable,
  ownableColumns,
} from "@agent-native/core/db/schema";

/**
 * A savings circle (ajo / esusu / tanda / chama / susu / hui).
 * Terms are editable only while `draft`; activation writes them into the
 * genesis ledger entry and freezes them.
 */
export const circles = pgTable("circles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  contributionMinor: bigint("contribution_minor", { mode: "number" }).notNull(),
  cadence: text("cadence", { enum: ["weekly", "biweekly", "monthly"] }).notNull(),
  startDate: text("start_date").notNull(),
  graceDays: integer("grace_days").notNull().default(2),
  timezone: text("timezone").notNull().default("Africa/Lagos"),
  status: text("status", { enum: ["draft", "active", "closed"] })
    .notNull()
    .default("draft"),
  /** Unguessable token for the public, read-only verification page. */
  publicToken: text("public_token").notNull(),
  /** Cached chain head, written in the same transaction as each append. */
  headSeq: integer("head_seq").notNull().default(0),
  headHash: text("head_hash").notNull().default("0".repeat(64)),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
  ...ownableColumns(),
});
export const circleShares = createSharesTable("circle_shares");

/** Profile data only. Money and payout order live in the ledger. */
export const members = pgTable("circle_members", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  /** JSON string[] of names this person's bank prints, e.g. "ADEBAYO TUNDE O". */
  aliases: text("aliases").notNull().default("[]"),
  /** Draft ordering; after activation the ledger is authoritative. */
  position: integer("position").notNull(),
  /** Unguessable token for the member's personal status page. */
  memberToken: text("member_token").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

/** Append-only. A database trigger rejects UPDATE and DELETE. */
export const ledgerEntries = pgTable("ledger_entries", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull(),
  seq: integer("seq").notNull(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  recordedAt: text("recorded_at").notNull(),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
  /** Who caused the write: app, agent, mcp, cli, automation. Not hashed. */
  recordedVia: text("recorded_via").notNull(),
  recordedBy: text("recorded_by").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

/** Inbox of pasted bank alerts awaiting a match decision. */
export const paymentSignals = pgTable("payment_signals", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull(),
  rawText: text("raw_text").notNull(),
  /** sha256 of the normalized alert text; unique per circle. */
  fingerprint: text("fingerprint").notNull(),
  reference: text("reference"),
  direction: text("direction").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }),
  currency: text("currency"),
  senderName: text("sender_name"),
  occurredOn: text("occurred_on"),
  extractedBy: text("extracted_by", { enum: ["parser", "agent"] }).notNull(),
  status: text("status", { enum: ["pending", "confirmed", "rejected"] })
    .notNull()
    .default("pending"),
  proposedMemberId: text("proposed_member_id"),
  /** JSON MatchProposal (allocations, reasons, alternatives). */
  proposal: text("proposal").notNull().default("{}"),
  confidence: integer("confidence").notNull().default(0),
  /** JSON number[] of ledger seqs written when confirmed. */
  ledgerSeqs: text("ledger_seqs"),
  resolutionNote: text("resolution_note"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  resolvedAt: text("resolved_at"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

/** Reminders the organizer actually sent, so nobody gets nagged twice a day. */
export const nudges = pgTable("nudges", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull(),
  memberId: text("member_id").notNull(),
  round: integer("round").notNull(),
  channel: text("channel", { enum: ["whatsapp", "sms", "copy"] }).notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});
