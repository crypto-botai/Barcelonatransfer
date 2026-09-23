import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fleetVehicleFrom, prefillFromLead, prefillFromUnpaid, type Lead, type Unpaid } from "@/lib/booking-import";

/**
 * The office finishing a booking the customer started.
 *
 * Phone customers who had already half-booked online were being typed in
 * from scratch, which meant a second booking row for the same journey: the
 * chase list kept emailing the dead one, and the reference the customer had
 * been given on screen belonged to neither. So an unpaid booking is now
 * completed in place and only a lead creates a new row, and these tests hold
 * that line at both ends — the mapping here, and the route that saves it.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const lead = (formData: Record<string, unknown>): Lead => ({
  sessionId: "sess_1", email: "guest@example.com", name: "Aaron Donovan", phone: "+34600111222",
  step: 3, formData, lastActivity: "2026-09-20T10:00:00.000Z", createdAt: "2026-09-20T09:00:00.000Z",
  abandonedBooking: null,
});

const unpaid = (over: Partial<Unpaid> = {}): Unpaid => ({
  id: "bk_1", confirmationCode: "EB-1234", guestName: "Mara Ilić", guestEmail: "mara@example.com", guestPhone: "+34600333444",
  pickupAddress: "Barcelona Airport T1", dropoffAddress: "Hotel Arts Barcelona",
  // 09:30 Madrid in September is 07:30 UTC.
  pickupDatetime: "2026-10-02T07:30:00.000Z",
  passengers: 3, vehicleClass: "LUXURY_MINIVAN", totalAmount: 95, createdAt: "2026-09-21T08:00:00.000Z",
  recoveryEmailedAt: null,
  pickupLat: 41.2974, pickupLng: 2.0833, dropoffLat: 41.3874, dropoffLng: 2.1962,
  luggage: 4, flightNumber: "VY8301", specialRequests: null,
  ...over,
});

describe("filling the office form from an abandoned cart", () => {
  it("carries the whole route, the party and the quoted price", () => {
    const p = prefillFromLead(lead({
      pickupAddress: "Barcelona Airport T2", pickupLat: 41.3, pickupLng: 2.07,
      dropoffAddress: "Sitges", dropoffLat: 41.23, dropoffLng: 1.81,
      date: "2026-10-05", time: "14:15", passengers: 4, luggage: 5,
      fleetVehicle: "V_CLASS", flightNumber: "FR2201", specialRequests: "Two surfboards",
      quote: { totalAmount: 130 },
    }));
    expect(p.name).toBe("Aaron Donovan");
    expect(p.pickup).toEqual({ address: "Barcelona Airport T2", lat: 41.3, lng: 2.07 });
    expect(p.dropoff.address).toBe("Sitges");
    expect(p.date).toBe("2026-10-05");
    expect(p.time).toBe("14:15");
    expect(p.pax).toBe(4);
    expect(p.bags).toBe(5);
    expect(p.vehicle).toBe("V_CLASS");
    expect(p.flight).toBe("FR2201");
    expect(p.price).toBe("130");
    expect(p.source).toEqual({ kind: "lead", sessionId: "sess_1", label: "Aaron Donovan" });
  });

  /**
   * The form has no extras field, so an extra that is not written into the
   * note is an extra nobody is told about: the customer paid for a baby seat
   * online and the car would arrive without one.
   */
  it("puts the extras they chose into the note for the chauffeur", () => {
    const p = prefillFromLead(lead({
      pickupAddress: "Plaça Catalunya", specialRequests: "Two surfboards",
      extras: [{ id: "baby_seat", label: "Baby seat", price: 5, quantity: 2 }, { id: "meet_greet", label: "Meet & greet", price: 5, quantity: 1 }],
    }));
    expect(p.notes).toContain("Two surfboards");
    expect(p.notes).toContain("Baby seat x2");
    expect(p.notes).toContain("Meet & greet");
  });

  it("survives a cart that holds almost nothing", () => {
    const p = prefillFromLead(lead({ pickupAddress: "Girona" }));
    expect(p.pickup.address).toBe("Girona");
    expect(p.dropoff.address).toBe("");
    expect(p.price).toBe("");
    expect(p.date).toBe("");
    // Defaults the office can see and change, never NaN in a number field.
    expect(p.pax).toBe(2);
    expect(p.bags).toBe(2);
    expect(p.vehicle).toBe("EQE_300");
  });
});

describe("filling the office form from an unpaid booking", () => {
  it("shows the pickup in Barcelona time, not the server's", () => {
    const p = prefillFromUnpaid(unpaid());
    expect(p.date).toBe("2026-10-02");
    expect(p.time).toBe("09:30");
  });

  it("keeps the customer's note and the extras, without the metadata block", () => {
    const meta = JSON.stringify({ bookingType: "TRANSFER", extras: [{ id: "name_board", label: "Name board", price: 5, quantity: 1 }] });
    const p = prefillFromUnpaid(unpaid({ specialRequests: `[META]${meta}[/META]\nPlease call on arrival` }));
    expect(p.notes).toContain("Please call on arrival");
    // parseBookingMeta relabels from EXTRAS_CATALOG, so the note carries the
    // catalogue's wording rather than whatever the checkout stored.
    expect(p.notes).toContain("Name Board");
    expect(p.notes).not.toContain("[META]");
  });

  it("names the booking it is completing, so the form can say so", () => {
    const p = prefillFromUnpaid(unpaid());
    expect(p.source).toEqual({ kind: "unpaid", bookingId: "bk_1", label: "EB-1234" });
    expect(p.price).toBe("95");
    expect(p.vehicle).toBe("V_CLASS");
  });
});

describe("the car the customer picked", () => {
  it("keeps the exact vehicle when the record has one", () => {
    expect(fleetVehicleFrom("CAMRY", "LUXURY")).toBe("CAMRY");
  });

  it("falls back to a car in the right class when only the class was stored", () => {
    expect(fleetVehicleFrom(null, "MINIBUS")).toBe("SPRINTER");
    expect(fleetVehicleFrom(null, "MINIVAN")).toBe("VITO");
  });

  it("never returns nothing for a class it does not know", () => {
    expect(fleetVehicleFrom(null, "SOMETHING_ELSE")).toBe("EQE_300");
    expect(fleetVehicleFrom("", null)).toBe("EQE_300");
  });
});

describe("saving an imported booking", () => {
  const route = rd("app/api/admin/bookings/route.ts");

  it("completes an unpaid booking in place instead of creating a second one", () => {
    expect(route).toContain("fromBookingId");
    expect(route).toContain("prisma.booking.update({ where: { id: existing.id }, data: fields })");
  });

  /**
   * The customer may pay the original link while the office is typing. Writing
   * over it then would wipe the payment and send a second confirmation for a
   * journey already booked.
   */
  it("refuses a booking that is no longer unpaid", () => {
    expect(route).toContain('existing.paymentStatus === "PAID" || existing.paymentMethod || existing.status !== "PENDING"');
    expect(route).toContain("status: 409");
  });

  it("closes the lead so the recovery emails stop", () => {
    expect(route).toContain("fromSessionId");
    expect(route).toContain("prisma.bookingSession.updateMany");
    expect(route).toContain("convertedAt: new Date()");
  });

  it("is reachable from the form and from the abandoned list", () => {
    const form = rd("app/admin/bookings/new/page.tsx");
    expect(form).toContain("ImportPanel");
    expect(form).toContain("fromBookingId: source?.kind === \"unpaid\"");
    expect(form).toContain("fromSessionId: source?.kind === \"lead\"");
    const list = rd("app/admin/abandoned/page.tsx");
    expect(list).toContain("/admin/bookings/new?booking=");
    expect(list).toContain("/admin/bookings/new?session=");
  });
});
