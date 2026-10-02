import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { journeysConfirmationCard, type JourneyLine } from "@/lib/email/premium";
import { togetherNote, togetherMarker, customerExtras } from "@/lib/journeys";

/**
 * One email for every journey in a booking.
 *
 * A return, an extra ride or a second car is a booking of its own, and the
 * customer used to hear about them one at a time, or after payment not at all:
 * the receipt covered the first booking only. These pin what the combined email
 * says, that its figures add up, and that the senders use it.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const mocks = vi.hoisted(() => ({ send: vi.fn(), logEmail: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class { emails = { send: mocks.send }; },
}));
vi.mock("@/lib/marketing", async (orig) => ({
  ...(await orig<typeof import("@/lib/marketing")>()),
  logEmail: mocks.logEmail,
}));

beforeEach(() => {
  mocks.send.mockReset().mockResolvedValue({ data: { id: "em_1" }, error: null });
  mocks.logEmail.mockReset().mockResolvedValue(undefined);
});

const J = (over: Partial<JourneyLine> = {}): JourneyLine => ({
  label: "Outbound", confirmationCode: "AAAA1111", date: "Sat 3 Oct 2026", time: "09:30",
  pickupAddress: "Terminal 2, Barcelona El Prat Airport BCN", dropoffAddress: "Hotel Arts Barcelona",
  vehicle: "Mercedes V-Class", passengers: 6, fare: 85, ...over,
});

describe("the combined card", () => {
  it("lists every journey with its own reference", () => {
    const html = journeysConfirmationCard({
      firstName: "Aaron", stage: "confirmed", totalAmount: 215,
      journeys: [J(), J({ label: "Journey 2", confirmationCode: "BBBB2222", fare: 45 }), J({ label: "Return", confirmationCode: "CCCC3333", fare: 85 })],
    });
    for (const code of ["AAAA1111", "BBBB2222", "CCCC3333"]) expect(html).toContain(code);
    for (const label of ["Outbound", "Journey 2", "Return"]) expect(html).toContain(label);
    expect(html).toContain("03");
    expect(html).toContain("All 3 of your journeys are confirmed");
  });

  it("says both for two journeys, and reserved before it is paid", () => {
    const two = journeysConfirmationCard({ firstName: "A", stage: "received", totalAmount: 170, journeys: [J(), J({ label: "Return", confirmationCode: "CCCC3333" })] });
    expect(two).toContain("Both of your journeys are reserved");
    expect(two).toContain("Bookings Received");
  });

  it("shows each journey's extras with their price, and 'Included' when free", () => {
    const html = journeysConfirmationCard({
      firstName: "A", stage: "confirmed", totalAmount: 105,
      journeys: [J({ extras: [{ label: "Baby Seat", quantity: 2, price: 5 }, { label: "Name Board", quantity: 1, price: 0 }] }), J({ label: "Return", confirmationCode: "CCCC3333" })],
    });
    expect(html).toContain("Baby Seat");
    expect(html).toContain("&times; 2");
    expect(html).toContain("&euro;10.00");
    expect(html).toContain("Included");
    expect(html).toContain("Extras for journey 1");
  });

  it("shows the difference as one line, so the figures always add up to the total", () => {
    const html = journeysConfirmationCard({
      firstName: "A", stage: "confirmed", totalAmount: 187, journeys: [J(), J({ label: "Return", confirmationCode: "CCCC3333" })],
      adjustment: { label: "VAT, tip and discounts", amount: 17 },
    });
    expect(html).toContain("VAT, tip and discounts");
    expect(html).toContain("&euro;17.00");
    expect(html).toContain("&euro;187.00");
  });

  it("shows no adjustment line when there is none", () => {
    const html = journeysConfirmationCard({ firstName: "A", stage: "confirmed", totalAmount: 170, journeys: [J(), J({ label: "Return", confirmationCode: "C" })], adjustment: null });
    expect(html).not.toContain("VAT, tip and discounts");
  });

  it("carries the pay button when the office created it unpaid", () => {
    const html = journeysConfirmationCard({
      firstName: "A", stage: "received", totalAmount: 170, journeys: [J(), J({ label: "Return", confirmationCode: "C" })],
      payment: { line: "Charged together.", payUrl: "https://www.elitebcn.info/pay/1" },
    });
    expect(html).toContain("https://www.elitebcn.info/pay/1");
    expect(html).toContain("Pay by Card");
  });

  it("never leaves a raw placeholder or an undefined in front of a customer", () => {
    const html = journeysConfirmationCard({ firstName: "A", stage: "confirmed", totalAmount: 170, journeys: [J(), J({ label: "Return", confirmationCode: "C" })] });
    expect(html).not.toMatch(/undefined|NaN|\{\{/);
  });

  it("escapes what a customer typed", () => {
    const html = journeysConfirmationCard({
      firstName: "<b>x</b>", stage: "confirmed", totalAmount: 85,
      journeys: [J({ pickupAddress: "<script>alert(1)</script>" }), J({ label: "Return", confirmationCode: "C" })],
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>x</b>");
  });
});

describe("the sender", () => {
  const base = {
    to: "a@b.com", name: "Aaron Donovan", totalAmount: 215, bookingId: "bk1", logType: "CONFIRMATION" as const,
  };
  const at = (iso: string) => new Date(iso);

  it("puts the journeys in the order they are travelled, whatever order they were made in", async () => {
    const { sendJourneysConfirmation } = await import("@/lib/resend");
    await sendJourneysConfirmation({
      ...base, stage: "received",
      journeys: [
        { role: "return", confirmationCode: "RET00001", pickupAddress: "B", dropoffAddress: "A", at: at("2026-10-10T12:00:00Z"), vehicleClass: "VCLASS", passengers: 2, fare: 85 },
        { role: "extra", confirmationCode: "MID00001", pickupAddress: "B", dropoffAddress: "C", at: at("2026-10-05T08:00:00Z"), vehicleClass: "VCLASS", passengers: 2, fare: 45 },
        { role: "outbound", confirmationCode: "OUT00001", pickupAddress: "A", dropoffAddress: "B", at: at("2026-10-03T07:30:00Z"), vehicleClass: "VCLASS", passengers: 2, fare: 85 },
      ],
    });
    const html = mocks.send.mock.calls[0][0].html as string;
    expect(html.indexOf("OUT00001")).toBeLessThan(html.indexOf("MID00001"));
    expect(html.indexOf("MID00001")).toBeLessThan(html.indexOf("RET00001"));
    // The middle one is the second journey, not "Journey 3".
    expect(html).toContain("Journey 2");
  });

  it("says how many journeys in the subject, and logs once against the first booking", async () => {
    const { sendJourneysConfirmation } = await import("@/lib/resend");
    await sendJourneysConfirmation({
      ...base, stage: "confirmed", logType: "PAYMENT_CONFIRMATION",
      journeys: [
        { role: "outbound", confirmationCode: "OUT00001", pickupAddress: "A", dropoffAddress: "B", at: at("2026-10-03T07:30:00Z"), vehicleClass: "VCLASS", passengers: 2, fare: 130 },
        { role: "return", confirmationCode: "RET00001", pickupAddress: "B", dropoffAddress: "A", at: at("2026-10-10T12:00:00Z"), vehicleClass: "VCLASS", passengers: 2, fare: 85 },
      ],
    });
    expect(mocks.send.mock.calls[0][0].subject).toMatch(/Your 2 journeys are confirmed — OUT00001/);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    const logged = mocks.logEmail.mock.calls[0][0];
    expect(logged).toMatchObject({ type: "PAYMENT_CONFIRMATION", bookingId: "bk1" });
  });

  it("accounts for VAT, a tip or a discount instead of letting the total drift", async () => {
    const { sendJourneysConfirmation } = await import("@/lib/resend");
    await sendJourneysConfirmation({
      ...base, stage: "confirmed", totalAmount: 187,
      journeys: [
        { role: "outbound", confirmationCode: "OUT00001", pickupAddress: "A", dropoffAddress: "B", at: at("2026-10-03T07:30:00Z"), vehicleClass: "VCLASS", passengers: 2, fare: 85 },
        { role: "return", confirmationCode: "RET00001", pickupAddress: "B", dropoffAddress: "A", at: at("2026-10-10T12:00:00Z"), vehicleClass: "VCLASS", passengers: 2, fare: 85 },
      ],
    });
    const html = mocks.send.mock.calls[0][0].html as string;
    expect(html).toContain("VAT, tip and discounts");
    expect(html).toContain("&euro;17.00");
  });
});

describe("finding the rest of an arrangement", () => {
  it("writes and searches for the same note, so an extra ride can be found again", () => {
    const note = togetherNote("ABC12345", "Child seat please");
    expect(note).toContain(togetherMarker("ABC12345"));
    expect(note).toContain("Child seat please");
    expect(togetherNote("ABC12345")).toBe(togetherMarker("ABC12345"));
  });

  it("lists a customer's extras but not VAT, which is not an item", () => {
    const raw = '[META]{"extras":[{"id":"baby_seat","label":"Baby Seat","price":5,"quantity":2},{"id":"invoice_vat","label":"I need an invoice","price":0,"quantity":1}]}[/META]';
    expect(customerExtras(raw)).toEqual([{ label: "Baby Seat", quantity: 2, price: 5 }]);
  });
});

describe("who sends it", () => {
  it("a paid booking with a return gets one receipt for both journeys", () => {
    const pay = rd("lib/payment-completion.ts");
    expect(pay).toContain("loadJourneyGroup(updated)");
    expect(pay).toMatch(/group\s*\?\s*sendJourneysConfirmation/);
    expect(pay).toContain('logType:    "PAYMENT_CONFIRMATION"');
  });

  it("a booking made by the office with more than one journey sends one email, not one per ride", () => {
    const admin = rd("app/api/admin/bookings/route.ts");
    expect(admin).toContain("sendJourneysConfirmation({");
    expect(admin).toMatch(/const multi = !!returnBooking \|\| extraBookings\.length > 0/);
    // A single journey keeps the email it always had.
    expect(admin).toMatch(/body\.sendEmail && !multi\) after\(\(\) => sendBookingConfirmation/);
    // The per-ride emails are gone.
    expect(admin).not.toContain("for (const b of extraBookings) {\n      after(() => sendBookingConfirmation");
    expect(admin).not.toMatch(/admin extra ride confirmation/);
  });

  it("extra rides are marked so that a later payment can find them", () => {
    const admin = rd("app/api/admin/bookings/route.ts");
    expect(admin).toContain("togetherNote(booking.confirmationCode, ride.specialRequests)");
  });

  it("a round trip on the website is told about in one email", () => {
    const site = rd("app/api/bookings/route.ts");
    expect(site).toContain("if (returnBooking && returnDatetime) {");
    expect(site).toContain("sendJourneysConfirmation({");
  });

  it("falls back to the single email when a booking cannot be listed truthfully", () => {
    const j = rd("lib/journeys.ts");
    // More than one car cannot be listed from the rows alone.
    expect(j).toContain("Vehicle \\d+ of \\d+");
    expect(j).toMatch(/if \(rest\.length === 0\) return null/);
  });
});
