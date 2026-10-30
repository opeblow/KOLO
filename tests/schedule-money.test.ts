import { describe, expect, it } from "vitest";

import { formatMoney, toMinor } from "../shared/money";
import { addMonths, isCalendarDate, roundDueDate } from "../shared/schedule";

describe("schedule", () => {
  it("clamps monthly rounds to the end of short months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(roundDueDate("2026-01-31", "monthly", 3)).toBe("2026-03-31");
  });
  it("spaces biweekly rounds 14 days apart", () => {
    expect(roundDueDate("2026-11-02", "biweekly", 2)).toBe("2026-11-16");
  });
  it("rejects impossible calendar dates", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-02-28")).toBe(true);
  });
});

describe("money", () => {
  it("uses integer minor units and rounds float noise", () => {
    expect(toMinor(0.1 + 0.2, "USD")).toBe(30);
    expect(toMinor(50_000, "NGN")).toBe(5_000_000);
    expect(toMinor(5000, "XOF")).toBe(5000);
  });
  it("formats without trailing zero fractions", () => {
    expect(formatMoney(5_000_000, "NGN")).toBe("₦50,000");
    expect(formatMoney(5_000_050, "NGN")).toBe("₦50,000.50");
    expect(formatMoney(-2_000, "USD")).toBe("−$20");
  });
});
