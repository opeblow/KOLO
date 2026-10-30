import {
  GENESIS_PREV_HASH,
  sealEntry,
  type AnyEntry,
  type EntryKind,
  type EntryKindMap,
  type GenesisPayload,
} from "../shared/ledger";

export const MEMBERS = [
  { id: "m1", name: "Tunde Adebayo" },
  { id: "m2", name: "Chioma Nwosu" },
  { id: "m3", name: "Bisi Olatunji" },
  { id: "m4", name: "Musa Ibrahim" },
];

export const GENESIS: GenesisPayload = {
  circleId: "c1",
  name: "Yaba Market Ajo",
  currency: "NGN",
  contributionMinor: 5_000_000, // ₦50,000
  cadence: "weekly",
  startDate: "2026-11-02",
  graceDays: 2,
  members: MEMBERS,
};

/** Build a correctly sealed chain from a list of [kind, payload] steps. */
export async function buildChain(
  steps: { [K in EntryKind]: [K, EntryKindMap[K]] }[EntryKind][],
): Promise<AnyEntry[]> {
  const out: AnyEntry[] = [];
  let prev = GENESIS_PREV_HASH;
  let t = Date.parse("2026-11-01T09:00:00Z");
  for (const [kind, payload] of [["circle.opened", GENESIS] as const, ...steps]) {
    t += 60_000;
    const sealed = await sealEntry(
      {
        seq: out.length + 1,
        kind,
        payload,
        recordedAt: new Date(t).toISOString(),
      } as never,
      prev,
    );
    out.push(sealed as AnyEntry);
    prev = sealed.hash;
  }
  return out;
}

export function fullRound(round: number) {
  return MEMBERS.map(
    (m) =>
      [
        "contribution",
        { memberId: m.id, round, amountMinor: 5_000_000, method: "transfer" },
      ] as ["contribution", EntryKindMap["contribution"]],
  );
}
