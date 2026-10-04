import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  users: vi.fn(),
  booking: vi.fn(),
  notify: vi.fn(),
  notifyAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: m.users }, booking: { findUnique: m.booking } } }));
vi.mock("@/lib/notifications/service", () => ({ notify: m.notify }));
vi.mock("@/lib/whatsapp", () => ({ notifyAdmin: m.notifyAdmin, ownerNumber: (v: string) => (v ? `+${v.replace(/\D/g, "")}` : null) }));

import { adminInboxes, mergeRecipients, resetAdminInboxCache } from "@/lib/admin-recipients";
import { officeBookingText, officeLeadText, tellOfficeBookingConfirmed, tellOfficeNewLead } from "@/lib/whatsapp-events";

/**
 * The office's alerts must reach someone.
 *
 * Every office email went from booking@elitebcn.info to booking@elitebcn.info and
 * none was ever opened; every WhatsApp alert failed because the template was not
 * approved. The two fixes: alerts go to each administrator's inbox as well, and
 * a WhatsApp alert whose template cannot be sent is said in plain words instead.
 */

describe("who gets an office email", () => {
  beforeEach(() => { resetAdminInboxCache(); m.users.mockReset(); });

  it("is the office mailbox first, then each administrator, once each", () => {
    expect(mergeRecipients("Booking@EliteBCN.info", ["owner@gmail.com", "booking@elitebcn.info", " Owner@Gmail.com ", null, "not an email"]))
      .toEqual(["booking@elitebcn.info", "owner@gmail.com"]);
  });

  it("never sends to more than five", () => {
    expect(mergeRecipients("a@x.com", ["b@x.com", "c@x.com", "d@x.com", "e@x.com", "f@x.com", "g@x.com"])).toHaveLength(5);
  });

  it("reads the administrators from the database, so nothing personal is in the code", async () => {
    m.users.mockResolvedValue([{ email: "owner@gmail.com" }, { email: "second@gmail.com" }]);
    expect(await adminInboxes("booking@elitebcn.info")).toEqual(["booking@elitebcn.info", "owner@gmail.com", "second@gmail.com"]);
    expect(m.users.mock.calls[0][0].where).toEqual({ role: "ADMIN" });
  });

  it("asks the database once for a while, not for every email", async () => {
    m.users.mockResolvedValue([{ email: "owner@gmail.com" }]);
    await adminInboxes("booking@elitebcn.info");
    await adminInboxes("booking@elitebcn.info");
    expect(m.users).toHaveBeenCalledTimes(1);
  });

  it("still reaches the office mailbox when the database cannot be read", async () => {
    m.users.mockRejectedValue(new Error("down"));
    expect(await adminInboxes("booking@elitebcn.info")).toEqual(["booking@elitebcn.info"]);
  });
});

const booking = {
  id: "b1", confirmationCode: "EBC-9", status: "CONFIRMED", guestName: "Ana Smith", guestEmail: "a@b.com", guestPhone: "+34600123456",
  pickupAddress: "Barcelona Airport T1", dropoffAddress: "Hotel Arts", pickupDatetime: new Date("2026-10-10T10:00:00Z"), passengers: 2, luggage: 1,
  vehicleClass: "BUSINESS", flightNumber: null, specialRequests: null, totalAmount: 95, paymentStatus: "PAID", paymentMethod: "CARD_LINK",
  depositAmount: null, balanceAmount: null, balancePaidAt: null, driverAmount: null, userId: null, driver: null,
};

describe("the office's WhatsApp alert", () => {
  beforeEach(() => {
    process.env.WA_ADMIN_NUMBER = "34635383712";
    m.notify.mockReset(); m.notifyAdmin.mockReset(); m.booking.mockReset();
    m.booking.mockResolvedValue(booking);
    m.notifyAdmin.mockResolvedValue(undefined);
  });

  it("goes as the approved template, and says nothing more when that works", async () => {
    m.notify.mockResolvedValue({ results: { whatsapp: { outcome: "sent" } } });
    await tellOfficeBookingConfirmed("b1");
    expect(m.notify.mock.calls[0][0]).toMatchObject({ event: "BOOKING_CONFIRMED_ADMIN", phone: "+34635383712" });
    expect(m.notifyAdmin).not.toHaveBeenCalled();
  });

  it("falls back to plain words when the template could not be sent, with what the office needs", async () => {
    m.notify.mockResolvedValue({ results: { whatsapp: { outcome: "failed", reason: "template not approved" } } });
    await tellOfficeBookingConfirmed("b1");
    const [text, opts] = m.notifyAdmin.mock.calls[0];
    expect(text).toContain("EBC-9");
    expect(text).toContain("Ana Smith");
    expect(text).toContain("€95");
    expect(text).toContain("Barcelona Airport T1 → Hotel Arts");
    expect(opts).toEqual({ emailFallback: false }); // the email already went
  });

  it("does the same for a new lead", async () => {
    m.notify.mockResolvedValue({ results: { whatsapp: { outcome: "failed", reason: "template not approved" } } });
    await tellOfficeNewLead({ name: "Taelor Hill", phone: "+351913422735", pickup: "Sants", dropoff: "Andorra", when: "10 Dec" });
    expect(m.notifyAdmin.mock.calls[0][0]).toContain("Taelor Hill");
    expect(m.notifyAdmin.mock.calls[0][0]).toContain("+351913422735");
  });

  it("respects the office's own switch: turned off means nothing is sent at all", async () => {
    m.notify.mockResolvedValue({ results: { whatsapp: { outcome: "skipped", reason: "office alerts are switched off" } } });
    await tellOfficeBookingConfirmed("b1");
    await tellOfficeNewLead({ name: "x" });
    expect(m.notifyAdmin).not.toHaveBeenCalled();
  });

  it("sends nothing without an office number, and never throws", async () => {
    delete process.env.WA_ADMIN_NUMBER; delete process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
    await expect(tellOfficeBookingConfirmed("b1")).resolves.toBeUndefined();
    expect(m.notify).not.toHaveBeenCalled();
    process.env.WA_ADMIN_NUMBER = "34635383712";
    m.notify.mockRejectedValue(new Error("boom"));
    await expect(tellOfficeNewLead({ name: "x" })).resolves.toBeUndefined();
  });

  it("writes the plain wording for a lead with gaps without printing 'undefined'", () => {
    expect(officeLeadText({})).not.toMatch(/undefined|null/);
    expect(officeBookingText({ ...booking, dropoffAddress: null } as never)).toContain("as arranged");
  });
});
