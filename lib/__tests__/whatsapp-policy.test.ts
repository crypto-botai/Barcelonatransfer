import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_AUTO_MESSAGES, MAX_PER_BOOKING, QUIET_WINDOW_MS, decideWhatsApp, sameness,
  type BookingFacts,
} from "@/lib/whatsapp-policy";
import { TEMPLATE_DEFS, templateProblems } from "@/lib/whatsapp-template-defs";

/**
 * How much WhatsApp a customer or driver can be sent.
 *
 * Every rule here exists to keep someone from being messaged too much, so each
 * one is checked from both sides: it sends when it should, and holds back when
 * it should.
 */

const NOW = new Date("2026-10-14T10:00:00Z");
const booking = (over: Partial<BookingFacts> = {}): BookingFacts => ({
  status: "CONFIRMED", paymentStatus: "PAID", paymentMethod: "CARD_LINK",
  pickupDatetime: new Date("2026-10-14T14:00:00Z"), ...over,
});
const decide = (over: Partial<Parameters<typeof decideWhatsApp>[0]> = {}) =>
  decideWhatsApp({
    event: "BOOKING_CONFIRMED", booking: booking(), sentBefore: 0, repeated: false,
    lastCustomerSendAt: null, now: NOW, settings: DEFAULT_AUTO_MESSAGES, ...over,
  });

describe("which messages exist at all", () => {
  it("allows the four customer messages and the driver's delay", () => {
    for (const e of ["BOOKING_CONFIRMED", "DRIVER_ASSIGNED", "FLIGHT_DELAYED", "PICKUP_SOON", "FLIGHT_DELAYED_DRIVER"]) {
      expect(decide({ event: e }), e).toEqual({ send: true });
    }
  });

  it("refuses everything else, however it is asked for", () => {
    for (const e of ["PICKUP_REMINDER", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "RIDE_ON_BOARD", "RIDE_COMPLETED", "REVIEW_REQUEST", "PAYMENT_RECEIVED", "RIDE_TODAY", "RATE_RIDE", "OFFICE_MESSAGE", "TRIP_MESSAGE", "WHATEVER"]) {
      expect(decide({ event: e }), e).toMatchObject({ send: false, reason: expect.stringMatching(/not one of the automatic/) });
    }
  });
});

describe("only paid bookings are messaged", () => {
  it("holds back every customer message for an unpaid booking", () => {
    for (const e of ["BOOKING_CONFIRMED", "DRIVER_ASSIGNED", "FLIGHT_DELAYED", "PICKUP_SOON"]) {
      expect(decide({ event: e, booking: booking({ paymentStatus: "PENDING" }) }), e).toMatchObject({ send: false, reason: "the booking is not paid" });
    }
  });

  it("holds back a failed or refunded payment", () => {
    for (const p of ["FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]) {
      expect(decide({ booking: booking({ paymentStatus: p }) }), p).toMatchObject({ send: false });
    }
  });

  it("messages a booking paid with a 30% deposit, which is a paid booking", () => {
    // The deposit marks the booking PAID; the balance is a separate matter.
    expect(decide({ booking: booking({ paymentStatus: "PAID" }) })).toEqual({ send: true });
  });

  it("does not message a cash-to-chauffeur booking unless the office switches that on", () => {
    const cash = booking({ paymentStatus: "PENDING", paymentMethod: "CASH" });
    expect(decide({ booking: cash })).toMatchObject({ send: false });
    expect(decide({ booking: cash, settings: { ...DEFAULT_AUTO_MESSAGES, cashBookings: true } })).toEqual({ send: true });
  });

  it("the cash switch does not make an unpaid card booking eligible", () => {
    const unpaidCard = booking({ paymentStatus: "PENDING", paymentMethod: "CARD_LINK" });
    expect(decide({ booking: unpaidCard, settings: { ...DEFAULT_AUTO_MESSAGES, cashBookings: true } })).toMatchObject({ send: false });
  });

  it("never messages a cancelled or refunded booking", () => {
    for (const s of ["CANCELLED", "REFUNDED"]) expect(decide({ booking: booking({ status: s }) }), s).toMatchObject({ send: false, reason: "the booking is cancelled" });
  });
});

describe("how many of each", () => {
  it("sends the confirmation once", () => {
    expect(decide({ sentBefore: 0 })).toEqual({ send: true });
    expect(decide({ sentBefore: 1 })).toMatchObject({ send: false, reason: expect.stringContaining("already sent 1 of 1") });
  });

  it("allows the driver's name twice, for a change of driver, and never the same name again", () => {
    expect(decide({ event: "DRIVER_ASSIGNED", sentBefore: 1 })).toEqual({ send: true });
    expect(decide({ event: "DRIVER_ASSIGNED", sentBefore: 2 })).toMatchObject({ send: false });
    expect(decide({ event: "DRIVER_ASSIGNED", sentBefore: 1, repeated: true })).toMatchObject({ send: false, reason: "this exact message was already sent" });
  });

  it("allows a delay to be updated once", () => {
    expect(decide({ event: "FLIGHT_DELAYED", sentBefore: 1 })).toEqual({ send: true });
    expect(decide({ event: "FLIGHT_DELAYED", sentBefore: 2 })).toMatchObject({ send: false });
  });

  it("caps a driver's delay messages", () => {
    expect(decide({ event: "FLIGHT_DELAYED_DRIVER", booking: null, sentBefore: MAX_PER_BOOKING.FLIGHT_DELAYED_DRIVER - 1 })).toEqual({ send: true });
    expect(decide({ event: "FLIGHT_DELAYED_DRIVER", booking: null, sentBefore: MAX_PER_BOOKING.FLIGHT_DELAYED_DRIVER })).toMatchObject({ send: false });
  });
});

describe("the one heads-up an hour before pickup", () => {
  const soon = (over: Partial<Parameters<typeof decideWhatsApp>[0]> = {}) => decide({ event: "PICKUP_SOON", ...over });

  it("goes when nothing else was sent recently", () => {
    expect(soon()).toEqual({ send: true });
  });

  it("is held back when another message went to this customer in the last two hours", () => {
    const justNow = new Date(NOW.getTime() - 30 * 60_000);
    expect(soon({ lastCustomerSendAt: justNow })).toMatchObject({ send: false, reason: expect.stringContaining("last 2 hours") });
  });

  it("goes once the last message is more than two hours old", () => {
    expect(soon({ lastCustomerSendAt: new Date(NOW.getTime() - QUIET_WINDOW_MS - 60_000) })).toEqual({ send: true });
  });

  it("is sent at most once, and not after pickup, and only if switched on", () => {
    expect(soon({ sentBefore: 1 })).toMatchObject({ send: false });
    expect(soon({ booking: booking({ pickupDatetime: new Date(NOW.getTime() - 60_000) }) })).toMatchObject({ send: false, reason: "the pickup time has passed" });
    expect(soon({ settings: { ...DEFAULT_AUTO_MESSAGES, headsUp: false } })).toMatchObject({ send: false });
  });

  it("a last-minute booking is told once, not three times in an hour", () => {
    // Booked 40 minutes before pickup: confirmation goes at 0, driver at +5, heads-up would be due at +10.
    const pickup = new Date(NOW.getTime() + 40 * 60_000);
    const b = booking({ pickupDatetime: pickup });
    expect(decide({ event: "BOOKING_CONFIRMED", booking: b })).toEqual({ send: true });
    const afterConfirmation = new Date(NOW.getTime() - 10 * 60_000);
    expect(decide({ event: "PICKUP_SOON", booking: b, lastCustomerSendAt: afterConfirmation })).toMatchObject({ send: false });
  });
});

describe("flight alerts", () => {
  it("can be switched off for customers and for drivers separately", () => {
    expect(decide({ event: "FLIGHT_DELAYED", settings: { ...DEFAULT_AUTO_MESSAGES, flightAlerts: false } })).toMatchObject({ send: false });
    expect(decide({ event: "FLIGHT_DELAYED", settings: { ...DEFAULT_AUTO_MESSAGES, driverFlightAlerts: false } })).toEqual({ send: true });
    expect(decide({ event: "FLIGHT_DELAYED_DRIVER", booking: null, settings: { ...DEFAULT_AUTO_MESSAGES, driverFlightAlerts: false } })).toMatchObject({ send: false });
    expect(decide({ event: "FLIGHT_DELAYED_DRIVER", booking: null, settings: { ...DEFAULT_AUTO_MESSAGES, flightAlerts: false } })).toEqual({ send: true });
  });

  it("is not sent for a pickup that has already happened", () => {
    expect(decide({ event: "FLIGHT_DELAYED", booking: booking({ pickupDatetime: new Date(NOW.getTime() - 3600_000) }) })).toMatchObject({ send: false });
  });

  it("a driver's delay does not depend on the customer paying", () => {
    expect(decide({ event: "FLIGHT_DELAYED_DRIVER", booking: booking({ paymentStatus: "PENDING" }) })).toEqual({ send: true });
  });
});

describe("sameness", () => {
  it("is the same driver, the same new landing time, the same recipient", () => {
    expect(sameness("DRIVER_ASSIGNED", { driver: "Pedro" }, { driver: "Pedro" })).toBe(true);
    expect(sameness("DRIVER_ASSIGNED", { driver: "Pedro" }, { driver: "Luis" })).toBe(false);
    expect(sameness("FLIGHT_DELAYED", { when: "14 Oct 13:20" }, { when: "14 Oct 13:20" })).toBe(true);
    expect(sameness("FLIGHT_DELAYED", { when: "14 Oct 13:50" }, { when: "14 Oct 13:20" })).toBe(false);
    expect(sameness("FLIGHT_DELAYED_DRIVER", { recipient: "u1" }, { recipient: "u2" })).toBe(false);
  });

  it("has no opinion about the other events or missing data", () => {
    expect(sameness("BOOKING_CONFIRMED", { code: "A" }, { code: "A" })).toBe(false);
    expect(sameness("DRIVER_ASSIGNED", undefined, { driver: "Pedro" })).toBe(false);
    expect(sameness("DRIVER_ASSIGNED", { driver: "Pedro" }, null)).toBe(false);
    expect(sameness("DRIVER_ASSIGNED", {}, { driver: "" })).toBe(false);
  });
});

describe("the template wording", () => {
  it("passes every rule Meta checks, for every template", () => {
    for (const t of TEMPLATE_DEFS) expect(templateProblems(t), t.name).toEqual([]);
  });

  it("has unique names Meta will accept, and one per automatic message", () => {
    const names = TEMPLATE_DEFS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(TEMPLATE_DEFS.map((t) => t.event).sort()).toEqual(["BOOKING_CONFIRMED", "DRIVER_ASSIGNED", "FLIGHT_DELAYED", "FLIGHT_DELAYED_DRIVER", "PICKUP_SOON"]);
  });

  it("is utility wording, never a promotion", () => {
    for (const t of TEMPLATE_DEFS) {
      expect(t.category).toBe("UTILITY");
      expect(t.body, t.name).not.toMatch(/discount|offer|% off|book now|special|limited|sale/i);
    }
  });

  it("never promises a paid extra as included", () => {
    for (const t of TEMPLATE_DEFS) expect(t.body, t.name).not.toMatch(/meet & greet|free|included/i);
  });

  it("catches wording Meta would refuse", () => {
    const base = TEMPLATE_DEFS[0];
    expect(templateProblems({ ...base, body: "{{1}} is your reference. Pickup {{2}}. Route {{3}}." })).toEqual(expect.arrayContaining([expect.stringMatching(/first or last/)]));
    expect(templateProblems({ ...base, body: "Reference {{1}}. Pickup {{2}}. Route {{3}}" + " {{4}}" })).not.toEqual([]);
    expect(templateProblems({ ...base, body: "Reference {{1}}. Route {{3}}. Thanks." })).toEqual(expect.arrayContaining([expect.stringMatching(/in order/)]));
    expect(templateProblems({ ...base, examples: ["only one"] })).toEqual(expect.arrayContaining([expect.stringMatching(/one example per slot/)]));
    expect(templateProblems({ ...base, name: "Booking Confirmation" })).toEqual(expect.arrayContaining([expect.stringMatching(/lower case/)]));
    expect(templateProblems({ ...base, body: "x".repeat(1100) })).not.toEqual([]);
  });
});

// ─── The guard: facts from the booking and the audit trail ───────────────────

const db = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn(), settings: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { booking: { findUnique: db.findUnique }, activityLog: { findMany: db.findMany } } }));
vi.mock("@/lib/whatsapp-settings-store", () => ({ loadSettings: db.settings }));

import { whatsappVerdict } from "@/lib/notifications/whatsapp-guard";
import { DEFAULT_SETTINGS } from "@/lib/whatsapp-settings";

const row = (event: string, minAgo: number, whatsapp: string, extra: Record<string, unknown> = {}) => ({
  action: `NOTIFY_${event}`, createdAt: new Date(NOW.getTime() - minAgo * 60_000), details: { channels: { whatsapp }, ...extra },
});

describe("whatsappVerdict reads what was really sent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.settings.mockResolvedValue(DEFAULT_SETTINGS);
    db.findUnique.mockResolvedValue({ status: "CONFIRMED", paymentStatus: "PAID", paymentMethod: "CARD_LINK", pickupDatetime: new Date("2026-10-14T14:00:00Z") });
    db.findMany.mockResolvedValue([]);
  });

  it("allows the first confirmation for a paid booking", async () => {
    expect(await whatsappVerdict({ event: "BOOKING_CONFIRMED", bookingId: "b1", now: NOW })).toEqual({ send: true });
  });

  it("refuses a second confirmation once one was sent", async () => {
    db.findMany.mockResolvedValue([row("BOOKING_CONFIRMED", 60, "sent")]);
    expect(await whatsappVerdict({ event: "BOOKING_CONFIRMED", bookingId: "b1", now: NOW })).toMatchObject({ send: false });
  });

  it("does not count a send that was skipped or failed", async () => {
    db.findMany.mockResolvedValue([row("BOOKING_CONFIRMED", 60, "skipped"), row("BOOKING_CONFIRMED", 50, "failed")]);
    expect(await whatsappVerdict({ event: "BOOKING_CONFIRMED", bookingId: "b1", now: NOW })).toEqual({ send: true });
  });

  it("refuses the same driver twice but allows a different one", async () => {
    db.findMany.mockResolvedValue([row("DRIVER_ASSIGNED", 90, "sent", { driver: "Pedro" })]);
    expect(await whatsappVerdict({ event: "DRIVER_ASSIGNED", bookingId: "b1", vars: { driver: "Pedro" }, now: NOW })).toMatchObject({ send: false });
    expect(await whatsappVerdict({ event: "DRIVER_ASSIGNED", bookingId: "b1", vars: { driver: "Luis" }, now: NOW })).toEqual({ send: true });
  });

  it("holds the heads-up back when the driver's name just went out", async () => {
    db.findMany.mockResolvedValue([row("DRIVER_ASSIGNED", 20, "sent", { driver: "Pedro" })]);
    expect(await whatsappVerdict({ event: "PICKUP_SOON", bookingId: "b1", now: NOW })).toMatchObject({ send: false });
  });

  it("a message sent to a different recipient does not use up the driver's allowance", async () => {
    db.findMany.mockResolvedValue([row("FLIGHT_DELAYED_DRIVER", 30, "sent", { recipient: "driver-1" })]);
    expect(await whatsappVerdict({ event: "FLIGHT_DELAYED_DRIVER", bookingId: "b1", vars: { recipient: "driver-2" }, now: NOW })).toEqual({ send: true });
    expect(await whatsappVerdict({ event: "FLIGHT_DELAYED_DRIVER", bookingId: "b1", vars: { recipient: "driver-1" }, now: NOW })).toMatchObject({ send: false });
  });

  it("refuses an unpaid booking and respects the office's switches", async () => {
    db.findUnique.mockResolvedValue({ status: "PENDING", paymentStatus: "PENDING", paymentMethod: "CARD_LINK", pickupDatetime: new Date("2026-10-14T14:00:00Z") });
    expect(await whatsappVerdict({ event: "BOOKING_CONFIRMED", bookingId: "b1", now: NOW })).toMatchObject({ send: false, reason: "the booking is not paid" });
    db.findUnique.mockResolvedValue({ status: "CONFIRMED", paymentStatus: "PAID", paymentMethod: "CARD_LINK", pickupDatetime: new Date("2026-10-14T14:00:00Z") });
    db.settings.mockResolvedValue({ ...DEFAULT_SETTINGS, autoMessages: { ...DEFAULT_AUTO_MESSAGES, flightAlerts: false } });
    expect(await whatsappVerdict({ event: "FLIGHT_DELAYED", bookingId: "b1", now: NOW })).toMatchObject({ send: false });
  });

  it("still lets a message that has the right to go through when the lookup fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    db.settings.mockRejectedValue(new Error("db down"));
    expect(await whatsappVerdict({ event: "BOOKING_CONFIRMED", bookingId: "b1", now: NOW })).toEqual({ send: true });
  });

  it("never lets an event outside the list through, even when the lookup fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    db.settings.mockRejectedValue(new Error("db down"));
    expect(await whatsappVerdict({ event: "DRIVER_EN_ROUTE", bookingId: "b1", now: NOW })).toMatchObject({ send: false });
  });

  it("asks only about this booking's notifications", async () => {
    await whatsappVerdict({ event: "BOOKING_CONFIRMED", bookingId: "b1", now: NOW });
    expect(db.findMany.mock.calls[0][0].where).toMatchObject({ entity: "Notification", entityId: "b1" });
  });
});
