import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prefillFromLead, type Lead } from "@/lib/booking-import";

/**
 * A round trip booked by the office.
 *
 * The website has offered a return since the booking widget was written, and
 * the office form did not: a customer who rang up to book both ways had to be
 * entered twice, by hand, as two unrelated bookings that nothing tied
 * together. The reference the customer was given covered one direction and
 * nobody could tell from either row that the other existed.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const api  = rd("app/api/admin/bookings/route.ts");
const form = rd("app/admin/bookings/new/page.tsx");

describe("the office can book a return", () => {
  it("takes a moment, not a second pair of addresses", () => {
    expect(api).toContain("returnDatetime:  z.string().optional()");
    expect(api).toContain("returnAmount:    z.number().min(0).optional()");
    // The route is the outbound one reversed, unless an end was overridden.
    expect(api).toContain("body.returnPickupAddress  || body.dropoffAddress || body.pickupAddress");
    expect(api).toContain("body.returnDropoffAddress || body.pickupAddress");
  });

  /**
   * Arriving at one hotel and leaving from another is ordinary: guests move
   * mid-stay, and plenty fly into El Prat and home out of Girona. Reversing
   * the outbound then sends a chauffeur to the wrong door.
   */
  it("lets either end of the way home be somewhere else", () => {
    for (const f of ["returnPickupAddress", "returnPickupLat", "returnPickupLng",
                     "returnDropoffAddress", "returnDropoffLat", "returnDropoffLng"]) {
      expect(api, f).toContain(f);
    }
    // Each falls back to the reversed value rather than to nothing.
    expect(api).toContain("body.returnPickupLat  ?? (body.dropoffLat || body.pickupLat)");
    expect(api).toContain("body.returnDropoffLat ?? body.pickupLat");
    // And the form starts from the reversed route so one end is edited, not both.
    expect(form).toContain("if (!returnFrom.address) setReturnFrom(dropoff)");
    expect(form).toContain("if (!returnTo.address) setReturnTo(pickup)");
  });

  it("writes it as its own booking, linked back to the outbound", () => {
    expect(api).toContain("returnOfId:      booking.id");
    expect(api).toContain("withUniqueBookingCode");
    expect(api).toContain("specialRequests: `Return leg of booking ${booking.confirmationCode}.`");
    // And the office is told both references.
    expect(api).toContain("returnConfirmationCode: returnBooking?.confirmationCode ?? null");
  });

  /** A flight number on the ride home makes the tracker wait for a landed plane. */
  it("does not carry the flight number onto the leg home", () => {
    expect(api).toContain("flightNumber:    null");
  });

  it("refuses a return that is not after the outbound", () => {
    expect(api).toContain("The return has to be after the outbound journey");
    expect(api).toContain("back <= pickup");
    // And the form says so before the button is pressed.
    expect(form).toContain("The return has to be after the outbound journey.");
    expect(form).toContain("const returnAfterOutbound =");
  });
});

describe("what the customer is charged", () => {
  /**
   * The card link used to be written for body.totalAmount, which is one leg.
   * Left alone, a round trip would have gone out with a link for half of it
   * and nothing anywhere saying the way home was unpaid.
   */
  it("bills the whole trip on one link, not just the outbound", () => {
    expect(api).toContain("const tripTotal = body.totalAmount + returnFare");
    expect(api).toContain("amount:        tripTotal");
    expect(api).toContain("paymentLine(body.paymentMethod as never, body.paymentStatus === \"PAID\", tripTotal)");
  });

  it("charges the same for the way back unless the office changes it", () => {
    expect(api).toContain("body.returnAmount ?? body.totalAmount");
    expect(form).toContain("returnPriceTouched && returnPrice !== \"\" ? parseFloat(returnPrice) : amount");
  });

  it("shows the office the trip total, not one leg", () => {
    expect(form).toContain("const tripTotal = amount +");
    expect(form).toContain("{legCount} bookings");
  });
});

describe("several rides for one customer", () => {
  const rides = rd("app/admin/bookings/new/ExtraRides.tsx");

  /**
   * A guest on a week's stay is one customer and several jobs. They were
   * being entered as unrelated bookings with the contact details retyped each
   * time, which is how a phone number ends up differing between two rides of
   * the same trip.
   */
  it("takes the customer once and the journeys many times", () => {
    expect(api).toContain("extraRides: z.array(");
    expect(form).toContain("<ExtraRides rides={rides} onChange={setRides}");
    expect(rides).toContain("More rides for this customer");
  });

  it("writes each as its own booking with its own reference", () => {
    expect(api).toContain("const extraBookings:");
    expect(api).toContain("extraConfirmationCodes: extraBookings.map((b) => b.confirmationCode)");
  });

  /** They are separate jobs, not legs of one trip, so they are not linked. */
  it("does not tie them together the way a return is tied", () => {
    const block = api.slice(api.indexOf("const extraBookings:"), api.indexOf("A lead that has become a booking"));
    expect(block).not.toContain("returnOfId");
  });

  /**
   * Parsed before anything is written, so a typo in the third ride does not
   * leave the first two in the database with no way to tell the office.
   */
  it("checks every date before creating any booking", () => {
    expect(api).toContain("const badExtra = extras.findIndex((r) => !r.at)");
    expect(api).toContain("has an invalid date or time");
  });

  it("charges the whole lot once, on the first ride", () => {
    expect(api).toContain("extras.reduce((s, r) => s + r.totalAmount, 0)");
    // And the others say so rather than leaving the customer wondering.
    expect(api).toContain("nothing to pay for this ride on its own");
  });

  /** Where to be, and how the chauffeur finds you, differs for every journey. */
  it("sends a confirmation for each, not a list on the first", () => {
    expect(api).toContain("for (const b of extraBookings)");
    expect(api).toContain("calendar: calendarLinks({ id: b.id");
  });

  it("will not create a half-filled ride", () => {
    expect(rides).toContain("export function rideReady(");
    expect(form).toContain("const ridesReady = rides.every(rideReady)");
    expect(form).toContain("Every extra ride needs both addresses, a date, a time and a price.");
  });

  it("quotes each ride at the website price, as the first one is", () => {
    expect(rides).toContain('fetch("/api/quote"');
    expect(rides).toContain("Use website price");
  });
});

describe("the confirmation email", () => {
  it("describes the leg home, reversed, with its own reference", () => {
    expect(api).toContain("returnLeg: returnBooking && back ?");
    expect(api).toContain("confirmationCode: returnBooking.confirmationCode");
  });

  /** Selling a return to somebody who has just booked one reads as a mistake. */
  it("stops offering to sell them a return once they have one", () => {
    expect(api).toContain("returnBooking ? null : returnTripUrl(");
  });
});

describe("importing a cart that wanted a return", () => {
  const lead = (formData: Record<string, unknown>): Lead => ({
    sessionId: "s1", email: "a@b.com", name: "Aaron Donovan", phone: "+34600111222",
    step: 3, formData, lastActivity: "2026-09-20T10:00:00.000Z", createdAt: "2026-09-20T09:00:00.000Z",
    abandonedBooking: null,
  });

  it("carries the dates the customer already typed", () => {
    const p = prefillFromLead(lead({
      pickupAddress: "Barcelona Airport T1", dropoffAddress: "Sitges",
      date: "2026-10-05", time: "14:15", returnDate: "2026-10-12", returnTime: "09:00",
    }));
    expect(p.returnDate).toBe("2026-10-12");
    expect(p.returnTime).toBe("09:00");
  });

  /** Half a return cannot be dispatched, so it is not offered as one. */
  it("ignores a return date with no time, and the other way round", () => {
    const noTime = prefillFromLead(lead({ pickupAddress: "A", returnDate: "2026-10-12" }));
    expect(noTime.returnDate).toBeUndefined();
    expect(noTime.returnTime).toBeUndefined();
    const noDate = prefillFromLead(lead({ pickupAddress: "A", returnTime: "09:00" }));
    expect(noDate.returnDate).toBeUndefined();
  });

  it("arrives at the form with the return already ticked", () => {
    expect(form).toContain("if (p.returnDate && p.returnTime) {");
    expect(form).toContain("setReturnOn(true)");
    // And cleared when the next import has none, rather than left on.
    expect(form).toContain("setReturnOn(false); setReturnDate(\"\"); setReturnTime(\"\");");
  });
});
