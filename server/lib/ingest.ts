import { fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";

import {
  normalizeForFingerprint,
  parseAlert,
  splitAlerts,
} from "../../shared/alerts.js";
import { sha256Hex } from "../../shared/ledger.js";
import { proposeMatch } from "../../shared/matcher.js";
import { formatMoney, toMinor } from "../../shared/money.js";
import { schema } from "../db/index.js";
import { parseAliases, readMembers, requireActive, type Locked } from "./circles.js";

export interface StructuredAlert {
  raw: string;
  amount?: number | undefined;
  senderName?: string | undefined;
  occurredOn?: string | undefined;
  reference?: string | undefined;
}

/** Parse, de-duplicate, match, and store alerts as pending inbox payments. */
export async function ingestIntoCircle(
  locked: Locked,
  args: { text?: string | undefined; alerts?: StructuredAlert[] | undefined },
  by: string,
) {
  const state = requireActive(locked);
  const { tx, circle } = locked;
  const currency = state.terms.currency;

  type Item = { raw: string; agent?: StructuredAlert };
  const items: Item[] = [
    ...(args.text ? splitAlerts(args.text).map((raw) => ({ raw })) : []),
    ...(args.alerts ?? []).map((a) => ({ raw: a.raw, agent: a })),
  ];
  if (items.length > 100) fail("Paste at most 100 alerts at a time.", { errorCode: "too_many_alerts" });

  const members = await readMembers(tx, circle.id);
  const identities = members.map((m) => ({ id: m.id, name: m.name, aliases: parseAliases(m.aliases) }));

  const prepared = await Promise.all(
    items.map(async (item) => {
      const parsed = parseAlert(item.raw);
      const a = item.agent;
      return {
        raw: parsed.raw,
        fingerprint: await sha256Hex(normalizeForFingerprint(parsed.raw)),
        direction: parsed.direction === "unknown" && a?.amount ? "credit" : parsed.direction,
        amountMinor: a?.amount !== undefined ? toMinor(a.amount, currency) : parsed.amountMinor,
        currency: a?.amount !== undefined ? currency : parsed.currency,
        senderName: a?.senderName ?? parsed.senderName,
        occurredOn: a?.occurredOn ?? parsed.occurredOn,
        reference: a?.reference ?? parsed.reference,
        extractedBy: (a && (a.amount !== undefined || a.senderName) ? "agent" : "parser") as "agent" | "parser",
        missing: parsed.missing.filter(
          (f) =>
            !(f === "amount" && a?.amount !== undefined) &&
            !(f === "sender" && a?.senderName) &&
            !(f === "date" && a?.occurredOn),
        ),
      };
    }),
  );

  const s = schema.paymentSignals;
  const fingerprints = prepared.map((p) => p.fingerprint);
  const references = prepared.map((p) => p.reference).filter((r): r is string => !!r);
  const existing = await tx
    .select({ id: s.id, fingerprint: s.fingerprint, reference: s.reference, status: s.status })
    .from(s)
    .where(and(eq(s.circleId, circle.id), inArray(s.fingerprint, fingerprints)))
    .limit(500);
  const existingByRef = references.length
    ? await tx
        .select({ id: s.id, reference: s.reference, status: s.status })
        .from(s)
        .where(and(eq(s.circleId, circle.id), inArray(s.reference, references)))
        .limit(500)
    : [];

  const seenFp = new Set(existing.map((e) => e.fingerprint));
  const seenRef = new Set(existingByRef.map((e) => e.reference));
  const added: {
    id: string;
    sender: string | null;
    amount: string | null;
    memberId: string | null;
    memberName: string | null;
    confidence: number;
    reasons: string[];
    missing: string[];
  }[] = [];
  const duplicates: { raw: string; why: string }[] = [];
  const skipped: { raw: string; why: string }[] = [];

  for (const p of prepared) {
    const preview = p.raw.slice(0, 80);
    if (seenFp.has(p.fingerprint)) {
      duplicates.push({ raw: preview, why: "This exact alert is already in the inbox or ledger." });
      continue;
    }
    if (p.reference && seenRef.has(p.reference)) {
      duplicates.push({ raw: preview, why: `Bank reference ${p.reference} was already recorded.` });
      continue;
    }
    if (p.direction === "debit") {
      skipped.push({ raw: preview, why: "Money going out, not a contribution." });
      continue;
    }
    seenFp.add(p.fingerprint);
    if (p.reference) seenRef.add(p.reference);

    const currencyMismatch = p.currency && p.currency !== currency;
    const proposal = currencyMismatch
      ? {
          memberId: null,
          allocations: [],
          leftoverMinor: 0,
          confidence: 0,
          reasons: [`The alert is in ${p.currency}; this circle runs in ${currency}.`],
          alternatives: [],
        }
      : proposeMatch(state, identities, { senderName: p.senderName, amountMinor: p.amountMinor });
    if (p.extractedBy === "agent") proposal.reasons.unshift("Fields read by the Kolo agent.");

    const id = crypto.randomUUID();
    await tx.insert(s).values({
      id,
      circleId: circle.id,
      rawText: p.raw,
      fingerprint: p.fingerprint,
      reference: p.reference,
      direction: p.direction,
      amountMinor: p.amountMinor,
      currency: p.currency,
      senderName: p.senderName,
      occurredOn: p.occurredOn,
      extractedBy: p.extractedBy,
      status: "pending",
      proposedMemberId: proposal.memberId,
      proposal: JSON.stringify(proposal),
      confidence: proposal.confidence,
      ownerEmail: by,
      orgId: circle.orgId,
    });
    added.push({
      id,
      sender: p.senderName,
      amount: p.amountMinor ? formatMoney(p.amountMinor, currency) : null,
      memberId: proposal.memberId,
      memberName: members.find((m) => m.id === proposal.memberId)?.name ?? null,
      confidence: proposal.confidence,
      reasons: proposal.reasons,
      missing: p.missing,
    });
  }

  const confident = added.filter((a) => a.confidence >= 85).length;
  const unreadable = added.filter((a) => a.missing.includes("amount") || a.missing.includes("sender"));
  return {
    id: circle.id,
    added,
    duplicates,
    skipped,
    message: `${added.length} added (${confident} confident), ${duplicates.length} duplicate, ${skipped.length} skipped.`,
    ...(unreadable.length
      ? {
          nextRequiredAction: `Read the ${unreadable.length} alert(s) with missing fields yourself and call amend-payment with what you find (ids: ${unreadable.map((u) => u.id).join(", ")}).`,
        }
      : {}),
  };
}
