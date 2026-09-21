import { describe, it, expect } from "vitest";
import {
  splitDeposit, isDepositEligible, DEPOSIT_PERCENT, DEPOSIT_MIN_FARE,
  paymentPlan, protectionFeeFor, returnDiscountFor, refundPolicy, collectDue, paidOnline,
  PROTECTION_PERCENT, PROTECTION_CUTOFF_HOURS, RETURN_DISCOUNT_PERCENT,
  CANCEL_WINDOW_HOURS, CITY_RADIUS_KM, tripKind, freeCancelHours,
} from "@/lib/deposits";

describe("deposit split", () => {
  it("takes the configured share up front", () => {
    expect(DEPOSIT_PERCENT).toBe(30);
    expect(splitDeposit(300)).toMatchObject({ deposit: 90, balance: 210, total: 300 });
    // Whole euros: 30% of €55 is €16.50, charged as €17 with €38 to follow.
    expect(splitDeposit(55)).toMatchObject({ deposit: 17, balance: 38, total: 55 });
  });

  it("always adds back to exactly the total", () => {
    // The balance is derived by subtraction rather than a second percentage.
    // A customer charged a balance that does not reconcile with their deposit
    // receipt will dispute it, so this must hold for every fare.
    for (let fare = 1; fare <= 900; fare += 1) {
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
  it("offers a deposit on every fare", () => {
    // The owner wants the 30% option on ordinary airport runs too: a customer
    // who will not put €50 on a card for a site they found ten minutes ago
    // will put €15.
    expect(DEPOSIT_MIN_FARE).toBe(0);
    for (const fare of [50, 60, 65, 75, 80, 145, 200, 450]) {
      expect(isDepositEligible(fare), `€${fare}`).toBe(true);
    }
    expect(isDepositEligible(0)).toBe(false);
  });
});

describe("payment plan", () => {
  it("charges everything now on a full payment", () => {
    expect(paymentPlan({ net: 50, vat: 0, tip: 0, protection: false, option: "FULL" }))
      .toMatchObject({ protectionFee: 0, total: 50, payNow: 50, balance: 0, option: "FULL" });
  });

  it("takes 30% now and leaves the rest for the chauffeur", () => {
    expect(paymentPlan({ net: 50, vat: 0, tip: 0, protection: false, option: "DEPOSIT" }))
      .toMatchObject({ total: 50, payNow: 15, balance: 35, option: "DEPOSIT" });
  });

  it("prices protection at 20% of the fare and always collects it up front", () => {
    expect(PROTECTION_PERCENT).toBe(20);
    expect(protectionFeeFor(50)).toBe(10);
    // Deposit + protection: 30% of the €50 fare plus the whole €10 fee now.
    // The fee is the one part never refunded, so it cannot sit in a balance
    // the customer may never pay.
    expect(paymentPlan({ net: 50, vat: 0, tip: 0, protection: true, option: "DEPOSIT" }))
      .toMatchObject({ protectionFee: 10, total: 60, payNow: 25, balance: 35 });
    expect(paymentPlan({ net: 50, vat: 0, tip: 0, protection: true, option: "FULL" }))
      .toMatchObject({ protectionFee: 10, total: 60, payNow: 60, balance: 0 });
  });

  it("splits VAT and tip with the fare, not the protection fee", () => {
    const p = paymentPlan({ net: 100, vat: 10, tip: 5, protection: true, option: "DEPOSIT" });
    expect(p.protectionFee).toBe(20);
    // 30% of 115 is 34.5, taken as a whole €35 (35 + 20 = 55 now).
    expect(p.payNow).toBe(55);
    expect(p.balance).toBe(80);
    expect(Math.round((p.payNow + p.balance) * 100) / 100).toBe(p.total);
  });

  it("gives 5% off a return journey", () => {
    expect(RETURN_DISCOUNT_PERCENT).toBe(5);
    expect(returnDiscountFor(50)).toBe(3);
    expect(returnDiscountFor(60)).toBe(3);
    expect(returnDiscountFor(200)).toBe(10);
  });
});

describe("the cancellation window depends on the journey", () => {
  it("is 24 h in the city, 48 h beyond it, 72 h for a minibus", () => {
    expect(CANCEL_WINDOW_HOURS).toMatchObject({ CITY: 24, INTERCITY: 48, MINIBUS: 72 });
    // Airport to city is ~15 km, the cruise port ~10, Sants ~14.
    expect(tripKind({ distanceKm: 15 })).toBe("CITY");
    expect(freeCancelHours({ distanceKm: 15 })).toBe(24);
    // Sitges at 35 km is the first journey on the far side of the line.
    expect(CITY_RADIUS_KM).toBe(30);
    expect(tripKind({ distanceKm: 35 })).toBe("INTERCITY");
    expect(freeCancelHours({ distanceKm: 210 })).toBe(48);
    // A minibus is a minibus wherever it goes.
    expect(tripKind({ distanceKm: 12, vehicleClass: "MINIBUS" })).toBe("MINIBUS");
    expect(freeCancelHours({ distanceKm: 12, vehicleClass: "MINIBUS" })).toBe(72);
  });
});

describe("refund policy", () => {
  const at = (hours: number) => new Date(Date.now() + hours * 3_600_000);

  it("refunds everything before the window closes", () => {
    expect(refundPolicy({ pickupDatetime: at(30), paidAmount: 50, protectionFee: null, freeHours: 24 }))
      .toMatchObject({ allowed: true, refund: 50, kept: 0, rule: "free-window" });
    // The same journey as an intercity run is still inside its 48 h window.
    expect(refundPolicy({ pickupDatetime: at(30), paidAmount: 50, protectionFee: null, freeHours: 48 }))
      .toMatchObject({ allowed: false, rule: "inside-window", freeHours: 48 });
  });

  it("refunds nothing inside the window, and never part of it", () => {
    const d = refundPolicy({ pickupDatetime: at(20), paidAmount: 50, protectionFee: 0, freeHours: 24 });
    expect(d).toMatchObject({ allowed: false, rule: "inside-window", freeHours: 24 });
    // There is no 50% tier any more: inside the window it is a WhatsApp
    // conversation with proof, not an automatic part-refund.
    expect(d.allowed).toBe(false);
  });

  it("defaults to the strictest window when the caller knows nothing", () => {
    expect(refundPolicy({ pickupDatetime: at(30), paidAmount: 50, protectionFee: null }))
      .toMatchObject({ allowed: true, rule: "free-window" });
    expect(refundPolicy({ pickupDatetime: at(20), paidAmount: 50, protectionFee: null }))
      .toMatchObject({ allowed: false, freeHours: 24 });
  });

  it("with protection, refunds the fare but keeps the fee up to two hours before", () => {
    expect(PROTECTION_CUTOFF_HOURS).toBe(2);
    // Protection beats the journey's own window: a 72 h minibus booking
    // cancelled 3 h out is still refunded when it was taken.
    expect(refundPolicy({ pickupDatetime: at(3), paidAmount: 60, protectionFee: 10, freeHours: 72 }))
      .toMatchObject({ allowed: true, refund: 50, kept: 10, rule: "protected" });
    // On a deposit booking only the deposit was paid; the fee still comes off it.
    expect(refundPolicy({ pickupDatetime: at(3), paidAmount: 25, protectionFee: 10 }))
      .toMatchObject({ allowed: true, refund: 15, kept: 10 });
  });

  it("refuses inside two hours even with protection", () => {
    expect(refundPolicy({ pickupDatetime: at(1), paidAmount: 60, protectionFee: 10, freeHours: 24 }))
      .toMatchObject({ allowed: false, rule: "inside-protection-cutoff" });
  });
});

describe("what the chauffeur collects", () => {
  it("is the balance on a deposit booking until it is marked paid", () => {
    expect(collectDue({ totalAmount: 50, paymentStatus: "PAID", balanceAmount: 35, balancePaidAt: null })).toBe(35);
    expect(collectDue({ totalAmount: 50, paymentStatus: "PAID", balanceAmount: 35, balancePaidAt: new Date() })).toBe(0);
  });

  it("is the whole fare on an unpaid cash booking, and nothing on a card booking", () => {
    expect(collectDue({ totalAmount: 50, paymentStatus: "PENDING", paymentMethod: "CASH" })).toBe(50);
    expect(collectDue({ totalAmount: 50, paymentStatus: "PAID", paymentMethod: "CARD_LINK" })).toBe(0);
  });

  it("reports the deposit as what was paid online", () => {
    expect(paidOnline({ totalAmount: 60, depositAmount: 25, paymentStatus: "PAID" })).toBe(25);
    expect(paidOnline({ totalAmount: 60, depositAmount: null, paymentStatus: "PAID" })).toBe(60);
    expect(paidOnline({ totalAmount: 60, depositAmount: 25, paymentStatus: "PENDING" })).toBe(0);
  });
});
