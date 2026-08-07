import { describe, it, expect } from "vitest";
import { applyCorporateDiscount, canSeeAllBookings, canManageCompany } from "@/lib/corporate";

describe("corporate discount", () => {
  it("leaves the fare alone at 0%", () => {
    expect(applyCorporateDiscount(80, 0)).toBe(80);
  });

  it("applies the agreed percentage", () => {
    expect(applyCorporateDiscount(80, 10)).toBe(72);
    expect(applyCorporateDiscount(50, 15)).toBe(42.5);
  });

  it("rounds to cents", () => {
    expect(applyCorporateDiscount(81, 12)).toBe(71.28);
  });

  it("can never produce a negative or inflated fare", () => {
    // A bad value in the database must not turn into money owed to the customer.
    expect(applyCorporateDiscount(80, 150)).toBe(0);
    expect(applyCorporateDiscount(80, -20)).toBe(80);
    expect(applyCorporateDiscount(80, 100)).toBe(0);
  });
});

describe("company roles", () => {
  it("lets bookers and admins see the whole company's travel", () => {
    expect(canSeeAllBookings("BOOKER")).toBe(true);
    expect(canSeeAllBookings("ADMIN")).toBe(true);
  });

  it("limits a traveller to their own journeys", () => {
    expect(canSeeAllBookings("TRAVELLER")).toBe(false);
  });

  it("reserves company management to admins", () => {
    expect(canManageCompany("ADMIN")).toBe(true);
    expect(canManageCompany("BOOKER")).toBe(false);
    expect(canManageCompany("TRAVELLER")).toBe(false);
  });
});
