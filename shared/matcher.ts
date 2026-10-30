/**
 * Proposes which member a payment belongs to and which rounds it covers,
 * with a confidence score and a plain-language reason. It only proposes:
 * a person (or the agent acting for them) confirms, and the ledger rules
 * still apply at confirmation time.
 */
import { allocatePayment, type CircleState } from "./circle-state";
import { formatMoney } from "./money";

export interface MemberIdentity {
  id: string;
  name: string;
  aliases: string[];
}

export interface MatchProposal {
  memberId: string | null;
  allocations: { round: number; amountMinor: number }[];
  leftoverMinor: number;
  /** 0–100. 85+ is safe to confirm in bulk; below 60 needs a human or the agent. */
  confidence: number;
  reasons: string[];
  alternatives: { memberId: string; name: string; score: number }[];
}

const HONORIFICS = new Set([
  "mr", "mrs", "ms", "miss", "dr", "chief", "alhaji", "alhaja", "pastor",
  "engr", "prof", "mama", "baba", "iya", "madam", "sir", "don", "dona",
]);

export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t));
}

/**
 * Order-insensitive token match. Banks print surname first ("ADEBAYO TUNDE O")
 * and truncate to initials, so "O" matches "Olumide" at half weight.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  const used = new Set<number>();
  let score = 0;
  for (const x of ta) {
    let best = 0;
    let bestIdx = -1;
    tb.forEach((y, i) => {
      if (used.has(i)) return;
      let s = 0;
      if (x === y) s = 1;
      else if (x.length === 1 || y.length === 1) s = x[0] === y[0] ? 0.5 : 0;
      else if (x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x))) s = 0.8;
      else s = editSimilarity(x, y) >= 0.8 ? 0.7 : 0;
      if (s > best) {
        best = s;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0) used.add(bestIdx);
    score += best;
  }
  // Dice-style: matched weight against the average token count.
  return Math.min(1, (2 * score) / (ta.length + tb.length));
}

/** 1 − normalised Levenshtein distance, using two rolling rows. */
function editSimilarity(a: string, b: string): number {
  let prev = Uint16Array.from({ length: b.length + 1 }, (_, j) => j);
  let curr = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return 1 - prev[b.length]! / Math.max(a.length, b.length, 1);
}

export function proposeMatch(
  state: CircleState,
  members: MemberIdentity[],
  payment: { senderName: string | null; amountMinor: number | null },
): MatchProposal {
  const currency = state.terms.currency;
  const reasons: string[] = [];

  const scored = members
    .map((m) => {
      const candidates = [m.name, ...m.aliases];
      const score = payment.senderName
        ? Math.max(...candidates.map((c) => nameSimilarity(payment.senderName!, c)))
        : 0;
      const viaAlias =
        payment.senderName &&
        m.aliases.some((a) => nameSimilarity(payment.senderName!, a) === score && score > nameSimilarity(payment.senderName!, m.name));
      return { memberId: m.id, name: m.name, score, viaAlias: Boolean(viaAlias) };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const runnerUp = scored[1];
  const alternatives = scored
    .slice(0, 3)
    .filter((s) => s.score > 0.2)
    .map(({ memberId, name, score }) => ({ memberId, name, score: Math.round(score * 100) }));

  if (!payment.senderName) {
    reasons.push("The alert has no readable sender name.");
  }
  if (!best || best.score < 0.4) {
    if (payment.senderName)
      reasons.push(`No member name resembles "${payment.senderName}".`);
    return {
      memberId: null,
      allocations: [],
      leftoverMinor: payment.amountMinor ?? 0,
      confidence: 0,
      reasons,
      alternatives,
    };
  }

  let nameConfidence = best.score;
  reasons.push(
    best.viaAlias
      ? `"${payment.senderName}" matches a saved bank name for ${best.name}.`
      : `"${payment.senderName}" matches ${best.name} (${Math.round(best.score * 100)}% name match).`,
  );
  if (runnerUp && best.score - runnerUp.score < 0.15) {
    nameConfidence -= 0.3;
    reasons.push(`It also resembles ${runnerUp.name}; check before confirming.`);
  }

  if (payment.amountMinor == null) {
    reasons.push("The amount could not be read.");
    return {
      memberId: best.memberId,
      allocations: [],
      leftoverMinor: 0,
      confidence: Math.round(Math.max(0, nameConfidence) * 50),
      reasons,
      alternatives,
    };
  }

  const { allocations, leftoverMinor } = allocatePayment(
    state,
    best.memberId,
    payment.amountMinor,
  );
  const contribution = state.terms.contributionMinor;
  let amountFit = 0;
  if (leftoverMinor > 0) {
    reasons.push(
      `${formatMoney(payment.amountMinor, currency)} is more than ${best.name} owes for the rest of the circle (${formatMoney(leftoverMinor, currency)} over).`,
    );
  } else if (allocations.length === 0) {
    reasons.push(`${best.name} has nothing left to pay.`);
  } else if (payment.amountMinor % contribution === 0) {
    amountFit = 1;
    const rounds = allocations.map((a) => a.round);
    reasons.push(
      allocations.length === 1
        ? `${formatMoney(payment.amountMinor, currency)} is exactly one contribution, applied to round ${rounds[0]}.`
        : `${formatMoney(payment.amountMinor, currency)} covers ${allocations.length} contributions: rounds ${rounds.join(", ")}.`,
    );
  } else {
    amountFit = 0.6;
    reasons.push(
      `${formatMoney(payment.amountMinor, currency)} is a part payment toward round ${allocations[0]?.round}.`,
    );
  }

  const confidence = Math.round(
    Math.max(0, Math.min(1, nameConfidence)) * 70 + amountFit * 30,
  );
  return {
    memberId: best.memberId,
    allocations: leftoverMinor > 0 ? [] : allocations,
    leftoverMinor,
    confidence: leftoverMinor > 0 ? Math.min(confidence, 40) : confidence,
    reasons,
    alternatives,
  };
}
