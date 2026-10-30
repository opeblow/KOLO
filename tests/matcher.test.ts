import { describe, expect, it } from "vitest";

import { foldLedger } from "../shared/circle-state";
import { nameSimilarity, proposeMatch, type MemberIdentity } from "../shared/matcher";
import { buildChain, fullRound } from "./fixtures";

const IDS: MemberIdentity[] = [
  { id: "m1", name: "Tunde Adebayo", aliases: [] },
  { id: "m2", name: "Chioma Nwosu", aliases: ["NWOSU C. ENTERPRISES"] },
  { id: "m3", name: "Bisi Olatunji", aliases: [] },
  { id: "m4", name: "Musa Ibrahim", aliases: [] },
];

describe("nameSimilarity", () => {
  it("handles surname-first bank formatting and initials", () => {
    expect(nameSimilarity("ADEBAYO TUNDE O", "Tunde Adebayo")).toBeGreaterThan(0.75);
  });
  it("ignores honorifics", () => {
    expect(nameSimilarity("Alhaji Musa Ibrahim", "Musa Ibrahim")).toBe(1);
  });
  it("scores unrelated names low", () => {
    expect(nameSimilarity("Grace Okafor", "Tunde Adebayo")).toBeLessThan(0.2);
  });
});

describe("proposeMatch", () => {
  it("is confident about an exact contribution from a clear sender", async () => {
    const state = foldLedger(await buildChain([]));
    const p = proposeMatch(state, IDS, { senderName: "Adebayo Tunde O", amountMinor: 5_000_000 });
    expect(p.memberId).toBe("m1");
    expect(p.allocations).toEqual([{ round: 1, amountMinor: 5_000_000 }]);
    expect(p.confidence).toBeGreaterThanOrEqual(85);
  });

  it("matches a business account through a saved alias", async () => {
    const state = foldLedger(await buildChain([]));
    const p = proposeMatch(state, IDS, { senderName: "Nwosu C Enterprises", amountMinor: 5_000_000 });
    expect(p.memberId).toBe("m2");
    expect(p.reasons[0]).toMatch(/saved bank name/);
  });

  it("applies the payment to the member's earliest unpaid round", async () => {
    const state = foldLedger(await buildChain(fullRound(1)));
    const p = proposeMatch(state, IDS, { senderName: "Bisi Olatunji", amountMinor: 10_000_000 });
    expect(p.allocations.map((a) => a.round)).toEqual([2, 3]);
  });

  it("refuses to guess when no member resembles the sender", async () => {
    const state = foldLedger(await buildChain([]));
    const p = proposeMatch(state, IDS, { senderName: "Grace Okafor", amountMinor: 5_000_000 });
    expect(p.memberId).toBeNull();
    expect(p.confidence).toBe(0);
  });

  it("caps confidence when the payment exceeds what the member owes", async () => {
    const state = foldLedger(await buildChain([]));
    const p = proposeMatch(state, IDS, { senderName: "Musa Ibrahim", amountMinor: 50_000_000 });
    expect(p.confidence).toBeLessThanOrEqual(40);
    expect(p.allocations).toEqual([]);
    expect(p.leftoverMinor).toBe(30_000_000);
  });
});
