import { describe, it, expect } from "vitest";
import { splitDeposit, isDepositEligible, DEPOSIT_PERCENT, DEPOSIT_MIN_FARE } from "@/lib/deposits";

describe("deposit split", () => {
  it("takes the configured share up front", () => {
    expect(DEPOSIT_PERCENT).toBe(30);
    expect(splitDeposit(300)).toMatchObject({ deposit: 90, balance: 210, total: 300 });
  });

  it("always adds back to exactly the total", () => {
    // The balance is derived by subtraction rather than a second percentage.
    // A customer charged a balance that does not reconcile with their deposit
    // receipt will dispute it, so this must hold for every fare.
    for (let fare = 200; fare <= 900; fare += 1) {
      const s = splitDeposit(fare);
      expect(Math.round((s.deposit + s.balance) * 100) / 100, `fare ${fare}`).toBe(s.total);
    }
  });

  it("holds for awkward percentages too", () => {
    for (const pct of [15, 33, 45, 66.7]) {
      for (const fare of [217, 333.33, 481.11]) {
        const s = splitDeposit(fare, pct);
        expect(Math.round((s.deposit + s.balance) * 100) / 100).toBe(s.total);
      }
    }
  });

  it("clamps a bad percentage instead of producing negative money", () => {
    expect(splitDeposit(300, 150)).toMatchObject({ deposit: 300, balance: 0 });
    expect(splitDeposit(300, -10)).toMatchObject({ deposit: 0, balance: 300 });
  });

  it("handles the whole-payment edges", () => {
    expect(splitDeposit(300, 0)).toMatchObject({ deposit: 0, balance: 300 });
    expect(splitDeposit(300, 100)).toMatchObject({ deposit: 300, balance: 0 });
  });
});

describe("deposit eligibility", () => {
  it("only offers deposits above the threshold", () => {
    // Below this the customer pays two card fees and gets two receipts to defer
    // very little cash.
    expect(DEPOSIT_MIN_FARE).toBe(200);
    expect(isDepositEligible(50)).toBe(false);
    expect(isDepositEligible(199.99)).toBe(false);
    expect(isDepositEligible(200)).toBe(true);
    expect(isDepositEligible(450)).toBe(true);
  });

  it("leaves ordinary airport fares paid in full", () => {
    // The common routes -- 50, 60, 65, 75 -- are all single-payment.
    for (const fare of [50, 60, 65, 75, 80, 145]) {
      expect(isDepositEligible(fare), `€${fare}`).toBe(false);
    }
  });
});
