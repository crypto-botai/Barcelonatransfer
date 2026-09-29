import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseBookingMeta, MAX_STOPS } from "@/lib/booking-meta";
import { driverJobCard } from "@/lib/email/premium";

/**
 * A stop the chauffeur is never told about.
 *
 * The catalogue has sold a "Multiple Stops" extra at €25 each since the
 * beginning, but it only ever charged: nowhere recorded WHERE the car was
 * meant to stop. A booking could carry a fee for two detours and no address
 * for either, so the office wrote them in the notes and hoped, or the driver
 * found out on the day.
 *
 * Stops are now part of the booking's metadata block, which means they
 * survive to the two places that need them: the office's own booking view and
 * the job email the chauffeur is sent.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("stops on a booking record", () => {
  const meta = (stops: unknown) => parseBookingMeta(`[META]${JSON.stringify({ stops })}[/META]\nnote`);

  it("reads the addresses back in the order they were written", () => {
    expect(meta(["Hotel Arts", "La Roca Village"]).stops).toEqual(["Hotel Arts", "La Roca Village"]);
  });

  it("keeps the customer's own note separate from them", () => {
    expect(meta(["Hotel Arts"]).notes).toBe("note");
  });

  it("drops blank and whitespace-only entries", () => {
    // Half-filled form fields, not places. Sending a driver to "" helps nobody.
    expect(meta(["Hotel Arts", "", "   "]).stops).toEqual(["Hotel Arts"]);
  });

  it("ignores anything that is not a string", () => {
    expect(meta(["Hotel Arts", 42, null, { a: 1 }]).stops).toEqual(["Hotel Arts"]);
  });

  it("never returns more than the catalogue sells", () => {
    expect(meta(["a1", "b2", "c3", "d4", "e5"]).stops).toHaveLength(MAX_STOPS);
  });

  it("is an empty list on a booking that has none", () => {
    expect(parseBookingMeta("just a note").stops).toEqual([]);
    expect(parseBookingMeta(null).stops).toEqual([]);
  });

  it("survives a malformed metadata block", () => {
    expect(parseBookingMeta("[META]{not json[/META]\nnote").stops).toEqual([]);
  });
});

describe("the office writes them down", () => {
  const route = rd("app/api/admin/bookings/route.ts");

  it("accepts stops when a booking is created", () => {
    expect(route).toContain("stops:           z.array(z.string().trim().min(3)).max(MAX_STOPS).optional()");
  });

  it("stores them in the metadata block, not a new column", () => {
    expect(route).toContain("withStops(body.specialRequests, body.stops)");
    expect(route).toContain('`[META]${JSON.stringify({ stops: clean })}[/META]');
  });

  it("leaves a booking with no stops stored exactly as before", () => {
    expect(route).toContain("if (clean.length === 0) return specialRequests;");
  });
});

describe("the chauffeur is told", () => {
  it("lists every stop in the job email", () => {
    const html = driverJobCard({
      driverName: "Marc", confirmationCode: "EB-1234",
      guestName: "A Guest", guestPhone: "+34600000000",
      pickupAddress: "Terminal 1 BCN", dropoffAddress: "Hotel Arts",
      stops: ["La Roca Village", "Sagrada Familia"],
      pickupDatetime: "29/09/2026, 09:00", vehicle: "Mercedes V-Class",
      passengers: 3, luggage: 2,
    });
    expect(html).toContain("Stop 1");
    expect(html).toContain("La Roca Village");
    expect(html).toContain("Stop 2");
    expect(html).toContain("Sagrada Familia");
  });

  it("puts them between pick-up and drop-off, in driving order", () => {
    const html = driverJobCard({
      driverName: "Marc", confirmationCode: "EB-1234",
      guestName: "A Guest", guestPhone: "+34600000000",
      pickupAddress: "Terminal 1 BCN", dropoffAddress: "Hotel Arts",
      stops: ["La Roca Village"],
      pickupDatetime: "29/09/2026, 09:00", vehicle: "Mercedes V-Class",
      passengers: 3, luggage: 2,
    });
    expect(html.indexOf("Terminal 1 BCN")).toBeLessThan(html.indexOf("La Roca Village"));
    expect(html.indexOf("La Roca Village")).toBeLessThan(html.indexOf("Hotel Arts"));
  });

  it("escapes an address rather than rendering markup from it", () => {
    const html = driverJobCard({
      driverName: "Marc", confirmationCode: "EB-1234",
      guestName: "A Guest", guestPhone: "+34600000000",
      pickupAddress: "T1", dropoffAddress: "Hotel",
      stops: ["<script>alert(1)</script>"],
      pickupDatetime: "29/09/2026, 09:00", vehicle: "V-Class",
      passengers: 1, luggage: 0,
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("adds no stop rows to an ordinary booking", () => {
    const html = driverJobCard({
      driverName: "Marc", confirmationCode: "EB-1234",
      guestName: "A Guest", guestPhone: "+34600000000",
      pickupAddress: "T1", dropoffAddress: "Hotel",
      pickupDatetime: "29/09/2026, 09:00", vehicle: "V-Class",
      passengers: 1, luggage: 0,
    });
    expect(html).not.toContain("Stop 1");
  });

  it("is handed them from the booking's own metadata", () => {
    expect(rd("lib/resend.ts")).toContain("stops: driverMeta.stops");
  });
});
