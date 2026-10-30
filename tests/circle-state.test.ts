import { describe, expect, it } from "vitest";

import {
  allocatePayment,
  checkClose,
  checkContribution,
  checkPayout,
  checkReversal,
  checkSwap,
  foldLedger,
  latePayments,
  trustExposure,
} from "../shared/circle-state";
import { buildChain, fullRound } from "./fixtures";

const POT = 20_000_000; // 4 × ₦50,000

describe("foldLedger", () => {
  it("derives the schedule, pot, and held balance from the log alone", async () => {
    const state = foldLedger(await buildChain(fullRound(1)));
    expect(state.size).toBe(4);
    expect(state.potMinor).toBe(POT);
    expect(state.rounds.map((r) => r.dueDate)).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
    ]);
    expect(state.heldMinor).toBe(POT);
    expect(state.nextPayoutRound).toBe(1);
  });

  it("ignores reversed contributions", async () => {
    const chain = await buildChain([
      ...fullRound(1),
      ["reversal", { targetSeq: 2, reason: "Bounced transfer" }],
    ]);
    const state = foldLedger(chain);
    expect(state.rounds[0].collectedMinor).toBe(POT - 5_000_000);
    expect(state.members.m1.paidMinor).toBe(0);
  });

  it("applies swaps to the payout order", async () => {
    const state = foldLedger(
      await buildChain([
        ["swap", { roundA: 1, roundB: 3, memberA: "m1", memberB: "m3", consent: "Both agreed in the group chat" }],
      ]),
    );
    expect(state.order).toEqual(["m3", "m2", "m1", "m4"]);
    expect(state.members.m1.payoutRound).toBe(3);
  });
});

describe("payout rules (the agent cannot bypass these)", () => {
  it("refuses to pay out an underfunded round and names who is missing", async () => {
    const state = foldLedger(await buildChain(fullRound(1).slice(0, 3)));
    const violation = checkPayout(state, { round: 1, memberId: "m1", amountMinor: POT });
    expect(violation?.code).toBe("round_not_funded");
    expect(violation?.details?.waitingOn).toEqual([
      { memberId: "m4", name: "Musa Ibrahim", owedMinor: 5_000_000 },
    ]);
  });

  it("refuses the wrong recipient", async () => {
    const state = foldLedger(await buildChain(fullRound(1)));
    expect(checkPayout(state, { round: 1, memberId: "m2", amountMinor: POT })?.code).toBe(
      "wrong_recipient",
    );
  });

  it("refuses rounds out of order", async () => {
    const state = foldLedger(await buildChain([...fullRound(1), ...fullRound(2)]));
    expect(checkPayout(state, { round: 2, memberId: "m2", amountMinor: POT })?.code).toBe(
      "out_of_order",
    );
  });

  it("refuses a payout that is not exactly the pot", async () => {
    const state = foldLedger(await buildChain(fullRound(1)));
    expect(
      checkPayout(state, { round: 1, memberId: "m1", amountMinor: POT - 1 })?.code,
    ).toBe("amount_mismatch");
  });

  it("allows a correct payout, then refuses paying the same round twice", async () => {
    const funded = foldLedger(await buildChain(fullRound(1)));
    expect(checkPayout(funded, { round: 1, memberId: "m1", amountMinor: POT })).toBeNull();
    const paid = foldLedger(
      await buildChain([
        ...fullRound(1),
        ["payout", { memberId: "m1", round: 1, amountMinor: POT }],
      ]),
    );
    expect(paid.heldMinor).toBe(0);
    expect(checkPayout(paid, { round: 1, memberId: "m1", amountMinor: POT })?.code).toBe(
      "round_already_paid",
    );
  });
});

describe("contribution rules", () => {
  it("refuses overpaying a round", async () => {
    const state = foldLedger(await buildChain(fullRound(1).slice(0, 1)));
    const violation = checkContribution(state, { memberId: "m1", round: 1, amountMinor: 1 });
    expect(violation?.code).toBe("overpayment");
  });

  it("refuses unknown members, bad rounds, and non-positive amounts", async () => {
    const state = foldLedger(await buildChain([]));
    expect(checkContribution(state, { memberId: "x", round: 1, amountMinor: 1 })?.code).toBe("unknown_member");
    expect(checkContribution(state, { memberId: "m1", round: 9, amountMinor: 1 })?.code).toBe("invalid_round");
    expect(checkContribution(state, { memberId: "m1", round: 1, amountMinor: 0 })?.code).toBe("invalid_amount");
    expect(checkContribution(state, { memberId: "m1", round: 1, amountMinor: 1.5 })?.code).toBe("invalid_amount");
  });

  it("splits a double payment across the member's next two rounds", async () => {
    const state = foldLedger(await buildChain(fullRound(1)));
    expect(allocatePayment(state, "m2", 10_000_000)).toEqual({
      allocations: [
        { round: 2, amountMinor: 5_000_000 },
        { round: 3, amountMinor: 5_000_000 },
      ],
      leftoverMinor: 0,
    });
  });

  it("reports leftover when a payment exceeds everything owed", async () => {
    const state = foldLedger(await buildChain([]));
    expect(allocatePayment(state, "m1", 25_000_000).leftoverMinor).toBe(5_000_000);
  });
});

describe("swap, reversal, close", () => {
  it("refuses swapping a round that already paid out", async () => {
    const state = foldLedger(
      await buildChain([...fullRound(1), ["payout", { memberId: "m1", round: 1, amountMinor: POT }]]),
    );
    expect(checkSwap(state, { roundA: 1, roundB: 2, consent: "Both agreed by phone" })?.code).toBe(
      "round_already_paid",
    );
  });

  it("requires recorded consent", async () => {
    const state = foldLedger(await buildChain([]));
    expect(checkSwap(state, { roundA: 1, roundB: 2, consent: "ok" })?.code).toBe("missing_consent");
  });

  it("makes contributions final once their round pays out", async () => {
    const chain = await buildChain([
      ...fullRound(1),
      ["payout", { memberId: "m1", round: 1, amountMinor: POT }],
    ]);
    expect(checkReversal(foldLedger(chain), chain, 2)?.code).toBe("not_reversible");
    expect(checkReversal(foldLedger(chain), chain, 6)?.code).toBe("not_reversible");
  });

  it("only closes after every round pays out", async () => {
    expect(checkClose(foldLedger(await buildChain(fullRound(1))))?.code).toBe(
      "rounds_outstanding",
    );
  });
});

describe("risk signals", () => {
  it("flags late payers after the grace period only", async () => {
    const state = foldLedger(await buildChain(fullRound(1).slice(0, 3)));
    expect(latePayments(state, "2026-11-04")).toHaveLength(0); // within 2 grace days
    const late = latePayments(state, "2026-11-06");
    expect(late).toEqual([
      expect.objectContaining({ memberId: "m4", round: 1, daysLate: 2 }),
    ]);
  });

  it("measures trust exposure: what past recipients still owe", async () => {
    const state = foldLedger(
      await buildChain([...fullRound(1), ["payout", { memberId: "m1", round: 1, amountMinor: POT }]]),
    );
    expect(trustExposure(state)).toEqual({
      totalMinor: 15_000_000,
      members: [{ memberId: "m1", name: "Tunde Adebayo", outstandingMinor: 15_000_000 }],
    });
  });
});
