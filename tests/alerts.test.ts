import { describe, expect, it } from "vitest";

import { parseAlert, parseAlertDate, splitAlerts } from "../shared/alerts";

describe("parseAlert — real-world formats", () => {
  it("reads a GTBank-style SMS and ignores the balance line", () => {
    const a = parseAlert(`Acct: 0123***789
Amt: NGN50,000.00 CR
Desc: TRANSFER FROM ADEBAYO TUNDE O
Avail Bal: NGN1,250,400.00
Date: 2026-11-03 10:22`);
    expect(a).toMatchObject({
      direction: "credit",
      amountMinor: 5_000_000,
      currency: "NGN",
      senderName: "Adebayo Tunde O",
      occurredOn: "2026-11-03",
      missing: [],
    });
  });

  it("reads an Access-style NIP alert with day-first dates", () => {
    const a = parseAlert(`Credit
Amt:NGN50,000.00
Acc:123**789
Desc:NIP/CHIOMA NWOSU/Ajo Nov
DT:04/11/2026 08:15
Avail Bal:NGN1,300,400.00`);
    expect(a.amountMinor).toBe(5_000_000);
    expect(a.senderName).toBe("Chioma Nwosu");
    expect(a.occurredOn).toBe("2026-11-04");
  });

  it("reads an OPay / Moniepoint notification", () => {
    const a = parseAlert(
      "You have received ₦100,000.00 from BISI OLATUNJI. Ref: 261104223344 on 04 Nov 2026",
    );
    expect(a).toMatchObject({
      direction: "credit",
      amountMinor: 10_000_000,
      senderName: "Bisi Olatunji",
      reference: "261104223344",
      occurredOn: "2026-11-04",
    });
  });

  it("reads an M-Pesa confirmation and strips the phone number", () => {
    const a = parseAlert(
      "QK12ABC3DE Confirmed. You have received Ksh5,000.00 from JOHN KAMAU 0712345678 on 3/11/26 at 10:22 AM New M-PESA balance is Ksh12,400.00.",
    );
    expect(a).toMatchObject({
      currency: "KES",
      amountMinor: 500_000,
      senderName: "John Kamau",
      reference: "QK12ABC3DE",
      occurredOn: "2026-11-03",
    });
  });

  it("reads a Zelle receipt with a US month-first date", () => {
    const a = parseAlert("You received $200.00 from MARIA LOPEZ via Zelle on 11/03/2026");
    expect(a).toMatchObject({
      currency: "USD",
      amountMinor: 20_000,
      senderName: "Maria Lopez",
      occurredOn: "2026-11-03",
    });
  });

  it("reads a Kuda-style 'sent you' message", () => {
    const a = parseAlert("Musa Ibrahim sent you ₦50,000");
    expect(a.senderName).toBe("Musa Ibrahim");
    expect(a.amountMinor).toBe(5_000_000);
    expect(a.missing).toEqual(["date"]);
  });

  it("marks debits so they are never counted as contributions", () => {
    const a = parseAlert("Debit Alert: Amt NGN20,000.00 DR. Desc: transfer to EKO ELECTRIC");
    expect(a.direction).toBe("debit");
  });

  it("reports exactly what it could not read", () => {
    const a = parseAlert("got it, thanks!");
    expect(a.amountMinor).toBeNull();
    expect(a.missing).toEqual(["amount", "sender", "date"]);
  });
});

describe("splitAlerts", () => {
  it("splits blocks separated by blank lines", () => {
    expect(splitAlerts("Amt: NGN5 CR\nDesc: from A\n\n\nAmt: NGN6 CR\nDesc: from B")).toHaveLength(2);
  });

  it("splits a block where every line is a complete alert", () => {
    const text = [
      "You have received ₦50,000 from TUNDE ADEBAYO",
      "You have received ₦50,000 from CHIOMA NWOSU",
    ].join("\n");
    expect(splitAlerts(text)).toHaveLength(2);
  });

  it("keeps a multi-line SMS together", () => {
    expect(
      splitAlerts("Acct: 0123***789\nAmt: NGN50,000.00 CR\nDesc: TRANSFER FROM ADEBAYO TUNDE O"),
    ).toHaveLength(1);
  });
});

describe("parseAlertDate", () => {
  it("rejects impossible dates", () => {
    expect(parseAlertDate("31/02/2026")).toBeNull();
  });
  it("reads month names", () => {
    expect(parseAlertDate("Nov 3, 2026")).toBe("2026-11-03");
    expect(parseAlertDate("3-November-2026")).toBe("2026-11-03");
  });
});
