import { describe, it, expect } from "vitest";
import fs from "fs";
import {
  TIERS,
  resolveTier,
  nextTierFor,
  isExtraWaived,
  extrasCostFor,
} from "@/lib/loyalty";
import { EXTRAS_CATALOG } from "@/types";

describe("membership tiers", () => {
  // The bug this guards: the loyalty page advertised Gold at €500 while the
  // stats API granted it at €1,000, so a customer at €600 was shown a tier the
  // rest of the site did not give them.
  it("grants Gold at the €500 the loyalty page advertises", () => {
    expect(resolveTier(499)).toBe("Silver");
    expect(resolveTier(500)).toBe("Gold");
    expect(resolveTier(600)).toBe("Gold");
  });

  it("reaches VIP only through the admin flag, never by spending", () => {
    expect(resolveTier(5000)).toBe("Gold");
    expect(resolveTier(0, true)).toBe("VIP");
  });

  it("never offers VIP as the next rung, since spending cannot reach it", () => {
    expect(nextTierFor("Silver")?.id).toBe("Gold");
    expect(nextTierFor("Gold")).toBeNull();
  });

  it("survives a missing or nonsense spend total", () => {
    expect(resolveTier(NaN)).toBe("Silver");
    expect(resolveTier(undefined as unknown as number)).toBe("Silver");
  });
});

describe("extras are priced by the server", () => {
  const meetGreet = EXTRAS_CATALOG.find((e) => e.id === "meet_greet")!;

  it("ignores the price the client sends", () => {
    // The hole: extrasCost was the client's own price times its own quantity.
    const crafted = [{ id: "meet_greet", price: -500, quantity: 1 }];
    expect(extrasCostFor(crafted)).toBe(meetGreet.price);
  });

  it("ignores an extra that is not in the catalogue", () => {
    expect(extrasCostFor([{ id: "free_helicopter", price: -9999, quantity: 1 }])).toBe(0);
  });

  it("caps quantity at the catalogue maximum", () => {
    const seat = EXTRAS_CATALOG.find((e) => e.id === "child_seat")!;
    expect(extrasCostFor([{ id: "child_seat", quantity: 99 }])).toBe(seat.price * seat.maxQty);
  });

  it("charges a guest the full price for meet & greet", () => {
    expect(extrasCostFor([{ id: "meet_greet", quantity: 1 }], "Silver")).toBe(5);
  });

  it("waives meet & greet for Gold, which is the advertised perk", () => {
    expect(isExtraWaived("Gold", "meet_greet")).toBe(true);
    expect(extrasCostFor([{ id: "meet_greet", quantity: 1 }], "Gold")).toBe(0);
  });

  it("still charges Gold for extras that are not part of the perk", () => {
    expect(extrasCostFor([{ id: "pet_transport", quantity: 1 }], "Gold")).toBe(20);
  });

  it("adds up a mixed basket", () => {
    const basket = [
      { id: "child_seat", quantity: 2 },   // 5 x 2
      { id: "meet_greet", quantity: 1 },   // 5, waived for Gold
      { id: "multi_stop", quantity: 1 },   // 25
    ];
    expect(extrasCostFor(basket, "Silver")).toBe(40);
    expect(extrasCostFor(basket, "Gold")).toBe(35);
  });
});

describe("no second copy of the tier table", () => {
  // Three copies existed before lib/loyalty.ts and they disagreed on the
  // threshold. A literal here means a fourth is being born.
  const files = [
    "app/dashboard/page.tsx",
    "app/dashboard/loyalty/page.tsx",
    "app/api/user/stats/route.ts",
  ];

  it.each(files)("%s reads the tiers rather than declaring them", (file) => {
    const src = fs.readFileSync(file, "utf8");
    expect(src, `${file} should import from @/lib/loyalty`).toMatch(/from "@\/lib\/loyalty"/);
    expect(src, `${file} still hardcodes a spend threshold`).not.toMatch(
      /totalSpent\s*>=\s*\d|threshold:\s*\d/,
    );
  });

  it("no page promises a free extra the checkout still charges for", () => {
    const waived = TIERS.flatMap((t) =>
      t.perks.filter((p) => /free|included|complimentary/i.test(p)).map((p) => [t.id, p] as const),
    );
    for (const [tierId, perk] of waived) {
      // Every "free"/"included" perk naming an extra must actually be waived.
      const named = EXTRAS_CATALOG.filter((e) =>
        perk.toLowerCase().includes(e.label.toLowerCase().replace(/ sign$/, "")),
      );
      for (const extra of named) {
        expect(
          isExtraWaived(tierId, extra.id),
          `${tierId} advertises "${perk}" but ${extra.id} is still charged`,
        ).toBe(true);
      }
    }
  });
});
