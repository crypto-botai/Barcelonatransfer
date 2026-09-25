import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adminNewBookingCard, driverJobCard } from "@/lib/email/premium";
import { parseBookingMeta, formatExtras } from "@/lib/booking-meta";

/**
 * The metadata block must never reach a reader.
 *
 * A booking's specialRequests field carries a [META]{…}[/META] prefix holding
 * the booking type, the extras, the tip and the VAT split. Printing the field
 * whole puts a line of JSON in front of the customer's own words.
 *
 * It got into the admin alert when that email was rebuilt on the house
 * template: the rebuild passed specialRequests straight through, where the
 * template it replaced had been careful to pass parseBookingMeta().notes. The
 * office saw eighty characters of JSON and then, underneath it, a customer
 * explaining that the real pickup was their hotel rather than the bar they
 * had been forced to type into the form. That is the kind of note a chauffeur
 * needs and a wall of JSON hides.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const RAW = '[META]{"bookingType":"TRANSFER","extras":[{"id":"baby_seat","label":"Baby Seat","price":5,"quantity":1}],'
  + '"extrasCost":5,"memberTier":"Silver","tipAmount":11.25}[/META] Hola, estamos en el Hotel Setenta, a unos pasos.';

describe("no email prints the metadata block", () => {
  it("the admin alert shows the note and not the JSON", () => {
    const meta = parseBookingMeta(RAW);
    const html = adminNewBookingCard({
      confirmationCode: "73R8NNQFXT",
      clientName: "Patricia Anne Caudill",
      clientEmail: "patty@example.com",
      clientPhone: "+12147282935",
      pickupAddress: "Terminal 1, El Prat Airport BCN",
      dropoffAddress: "El Chiringuito Bar, Barcelona",
      date: "03/10/2026", time: "10:30",
      vehicleLabel: "Mercedes V-Class",
      passengers: 4,
      totalAmount: 86.25,
      notes: meta.notes,
      extras: meta.extras.length ? formatExtras(meta.extras) : null,
      tipAmount: meta.tipAmount,
    });

    expect(html).not.toContain("[META]");
    expect(html).not.toContain("bookingType");
    expect(html).not.toContain("extrasCost");
    expect(html).not.toContain("memberTier");
    // The customer's actual message survives.
    expect(html).toContain("Hotel Setenta");
  });

  /**
   * The rows that were dropped in the rebuild. An extra nobody is told about
   * is a car that turns up without a child seat in it.
   */
  it("the admin alert shows the extras and the tip", () => {
    const meta = parseBookingMeta(RAW);
    const html = adminNewBookingCard({
      confirmationCode: "X", clientName: "A", clientEmail: "a@b.com",
      pickupAddress: "P", dropoffAddress: "D", date: "01/01/2027", time: "10:00",
      vehicleLabel: "V-Class", passengers: 4, totalAmount: 100,
      notes: meta.notes,
      extras: meta.extras.length ? formatExtras(meta.extras) : null,
      tipAmount: meta.tipAmount,
    });
    expect(html).toContain("Extras");
    expect(html).toContain("Baby Seat");
    expect(html).toContain("Driver tip");
    expect(html).toContain("11.25");
  });

  it("leaves the rows out when there is nothing in them", () => {
    const html = adminNewBookingCard({
      confirmationCode: "X", clientName: "A", clientEmail: "a@b.com",
      pickupAddress: "P", dropoffAddress: "D", date: "01/01/2027", time: "10:00",
      vehicleLabel: "V-Class", passengers: 2, totalAmount: 100,
      notes: null, extras: null, tipAmount: 0,
    });
    expect(html).not.toContain("Extras");
    expect(html).not.toContain("Driver tip");
    // Notes still shows, as a dash, because its absence is itself worth saying.
    expect(html).toContain("Notes");
  });

  it("the driver's job sheet does the same", () => {
    const meta = parseBookingMeta(RAW);
    const html = driverJobCard({
      driverName: "Marc", confirmationCode: "X", guestName: "A", guestPhone: "+34600",
      pickupAddress: "P", dropoffAddress: "D", pickupDatetime: "2027-01-01 10:00",
      vehicle: "V-Class", passengers: 4, luggage: 4,
      extras: meta.extras.length ? formatExtras(meta.extras) : null,
      tipAmount: meta.tipAmount,
      notes: meta.notes,
    });
    expect(html).not.toContain("[META]");
    expect(html).toContain("Hotel Setenta");
    expect(html).toContain("Baby Seat");
  });
});

describe("the senders strip it before handing it over", () => {
  /**
   * The rule, stated where it can be checked: a card is given
   * parseBookingMeta(...).notes, never the raw field.
   */
  it("no card is passed specialRequests as its notes", () => {
    const premium = rd("lib/email/premium.ts");
    expect(premium).not.toContain("esc(o.specialRequests)");

    const resend = rd("lib/resend.ts");
    // Both emails that show a note derive it from the parsed metadata.
    expect(resend).toContain("notes: meta.notes");
    expect(resend).toContain("notes: driverMeta.notes");
  });
});
