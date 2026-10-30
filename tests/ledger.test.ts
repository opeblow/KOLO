import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  GENESIS_PREV_HASH,
  sealOf,
  verifyChain,
  type AnyEntry,
} from "../shared/ledger";
import { buildChain, fullRound } from "./fixtures";

describe("canonicalJson", () => {
  it("sorts keys and drops undefined so equal payloads hash equally", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [2, 1] } })).toBe(
      '{"a":{"c":[2,1]},"b":1}',
    );
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });

  it("refuses non-finite numbers instead of silently writing null", () => {
    expect(() => canonicalJson({ a: Number.NaN })).toThrow();
  });
});

describe("verifyChain", () => {
  it("accepts an untouched chain and reports its head", async () => {
    const chain = await buildChain(fullRound(1));
    const result = await verifyChain(chain);
    expect(result).toEqual({
      ok: true,
      count: 5,
      headHash: chain[4].hash,
    });
    expect(chain[0].prevHash).toBe(GENESIS_PREV_HASH);
  });

  it("detects an edited amount at the exact entry", async () => {
    const chain = await buildChain(fullRound(1));
    const tampered = structuredClone(chain) as AnyEntry[];
    (tampered[2].payload as { amountMinor: number }).amountMinor = 1;
    const result = await verifyChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.brokenAt).toBe(3);
      expect(result.reason).toBe("hash_mismatch");
    }
  });

  it("detects a deleted entry", async () => {
    const chain = await buildChain(fullRound(1));
    const result = await verifyChain([...chain.slice(0, 2), ...chain.slice(3)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("sequence_gap");
  });

  it("detects a forger who re-hashes one entry but not the next", async () => {
    const chain = await buildChain(fullRound(1));
    const forged = structuredClone(chain) as AnyEntry[];
    forged[1] = { ...forged[1], hash: "f".repeat(64) };
    const result = await verifyChain(forged);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.brokenAt).toBe(2);
  });

  it("detects a backdated timestamp", async () => {
    const chain = await buildChain(fullRound(1));
    const forged = structuredClone(chain) as AnyEntry[];
    forged[3].recordedAt = "2020-01-01T00:00:00.000Z";
    const result = await verifyChain(forged);
    expect(result.ok).toBe(false);
  });

  it("formats a short seal members can read aloud", () => {
    expect(sealOf("3f9ac21e" + "0".repeat(56))).toBe("3f9a·c21e");
  });
});
