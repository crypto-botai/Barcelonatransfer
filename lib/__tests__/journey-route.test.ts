import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The rules the journey endpoint has to keep.
 *
 * Changing when a booking runs or where it goes touches money and tells a
 * customer their car is coming somewhere or sometime else, so the things that
 * must not slip are: only the office can do it, a finished booking cannot be
 * changed, nothing is written until the office has seen what the change costs
 * and said yes, and the two pricing bases stay apart.
 */

const ROOT = join(__dirname, "..", "..");
const route = readFileSync(
  join(ROOT, "app", "api", "admin", "bookings", "[id]", "journey", "route.ts"),
  "utf-8",
);

describe("who may change a booking", () => {
  it("refuses anyone who is not an admin", () => {
    expect(route).toContain("if (!await requireAdmin())");
    expect(route).toContain("{ status: 401 }");
    expect(route).toContain('u.role !== "ADMIN"');
  });

  /**
   * Customers were deliberately left out: they must call the office. The
   * file living under app/api/admin is what makes that true — reading it
   * from there above is the assertion; this guards the check inside it from
   * being relaxed to "any signed-in user owns this booking".
   */
  it("does not fall back to an ownership check", () => {
    expect(route).not.toMatch(/booking\.userId === user\.id/);
    expect(route).not.toMatch(/guestEmail === user\.email/);
  });
});

describe("which bookings may be changed", () => {
  it("refuses a cancelled, refunded or completed booking", () => {
    expect(route).toContain('const CLOSED = ["CANCELLED", "REFUNDED", "COMPLETED"]');
    expect(route).toContain("CLOSED.includes(booking.status)");
    expect(route).toContain("{ status: 409 }");
  });

  it("rejects a date and time that is not real", () => {
    expect(route).toContain("pickupToUtc(body.date, body.time)");
    expect(route).toContain("That is not a real date and time.");
  });

  it("refuses a request that changes nothing", () => {
    expect(route).toContain("if (!routeChanged && !timeChanged)");
    expect(route).toContain("Nothing has changed.");
  });
});

describe("addresses", () => {
  /**
   * lat 999 / lng 999 was once accepted by the quote API and priced as a
   * 26,599 km journey. The office must not be able to do the same thing.
   */
  it("bounds the coordinates it will price from", () => {
    expect(route).toContain("lat: z.number().min(-90).max(90)");
    expect(route).toContain("lng: z.number().min(-180).max(180)");
  });

  /**
   * The address box reports 0,0 for text typed but never chosen from the
   * list, and 0,0 sits inside the bounds above — it is in the Gulf of
   * Guinea, some 4,700 km from Barcelona. Pricing from it would produce a
   * fare for a journey nobody is making.
   */
  it("refuses the 0,0 an unchosen address reports", () => {
    expect(route).toContain("e.lat !== 0 && e.lng !== 0");
    expect(route).toContain("Choose the address from the list");
  });

  it("leaves an untouched end of the journey exactly as it was", () => {
    expect(route).toContain("effectiveEndpoint(currentPickup,  body.pickup)");
    expect(route).toContain("effectiveEndpoint(currentDropoff, body.dropoff)");
  });

  it("writes the coordinates alongside the address, never the text alone", () => {
    const update = route.slice(route.indexOf("prisma.booking.update"));
    for (const field of ["pickupAddress:", "pickupLat:", "pickupLng:", "dropoffAddress:", "dropoffLat:", "dropoffLng:"]) {
      expect(update, field).toContain(field);
    }
  });

  it("stores the recomputed distance and duration with the new route", () => {
    const update = route.slice(route.indexOf("prisma.booking.update"));
    expect(update).toContain("distanceKm,");
    expect(update).toContain("durationMin,");
  });
});

describe("the two pricing bases stay apart", () => {
  /**
   * A time change must not requote. The fare was agreed when the booking was
   * taken; re-running getQuote would silently reprice it at whatever the
   * table says today.
   */
  it("prices a time-only change from the stored fare", () => {
    expect(route).toContain('basis = "time-only"');
    expect(route).toContain("repriceForNewTime(");
  });

  /** A different journey has no agreed fare, so it is quoted afresh. */
  it("requotes when an address moved", () => {
    expect(route).toContain('basis = "requoted"');
    expect(route).toContain("await getQuote({");
    expect(route).toContain("await roadDistance(");
  });

  it("chooses the basis from what actually moved", () => {
    expect(route).toContain("const routeChanged   = pickupChanged || dropoffChanged");
    expect(route).toContain("if (routeChanged) {");
  });

  it("uses the same pricing engine as the booking form", () => {
    expect(route).toContain('from "@/lib/pricing-service"');
    expect(route).not.toMatch(/totalAmount\s*[*]\s*1\.\d/);
  });

  /** Writing a fare nobody stands behind is worse than refusing. */
  it("refuses rather than inventing a price it could not quote", () => {
    expect(route).toContain("quote.needsManualQuote");
    expect(route).toContain("{ status: 422 }");
  });
});

describe("nothing is written before the office confirms", () => {
  it("defaults to a preview", () => {
    expect(route).toContain("confirm: z.boolean().default(false)");
  });

  it("returns the quote and stops when not confirmed", () => {
    const i = route.indexOf("if (!body.confirm)");
    expect(i).toBeGreaterThan(-1);
    // The update must come after the early return, never before it.
    expect(route.indexOf("prisma.booking.update")).toBeGreaterThan(i);
  });

  it("lets the office waive the price change", () => {
    expect(route).toContain("applyPriceChange: z.boolean().default(true)");
    expect(route).toContain("body.applyPriceChange && difference !== 0");
  });

  /**
   * A waived change still moves the addresses, so the stored breakdown must
   * not be rewritten to a fare that is not being charged.
   */
  it("does not write a fare breakdown it is not applying", () => {
    const update = route.slice(route.indexOf("prisma.booking.update"));
    expect(update).toContain("...(willApplyPrice");
    expect(update).toContain("baseFare,");
  });
});

describe("money", () => {
  it("does not rewrite a balance that has already been collected", () => {
    expect(route).toContain("booking.balancePaidAt == null");
  });

  it("puts the difference on the balance, not the deposit", () => {
    expect(route).toContain("applyToBalance(booking, difference)");
    expect(route).not.toMatch(/depositAmount:\s*(priced|difference|newTotal)/);
  });

  it("never charges a card by itself", () => {
    expect(route).not.toMatch(/createCheckout|sumup|stripe/i);
  });
});

describe("telling the customer", () => {
  it("emails them by default", () => {
    expect(route).toContain("notifyCustomer: z.boolean().default(true)");
    expect(route).toContain("sendBookingRescheduledEmail");
  });

  /** A mail problem must not undo a change the office has already made. */
  it("does not let a failed email roll back the change", () => {
    const send = route.slice(route.indexOf("sendBookingRescheduledEmail"));
    expect(send).toContain(".catch(");
  });

  /**
   * The email says what moved. Passing the old address for an end that did
   * not move would tell the customer their pick-up changed when it did not.
   */
  it("sends an old address only for the end that actually moved", () => {
    expect(route).toContain("oldPickupAddress:  pickupChanged  ? booking.pickupAddress  : null");
    expect(route).toContain("oldDropoffAddress: dropoffChanged ? booking.dropoffAddress : null");
    expect(route).toContain("timeChanged,");
  });
});
