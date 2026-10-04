import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  role: "ADMIN" as string | null,
  booking: vi.fn(),
  logs: vi.fn(),
  create: vi.fn(),
  notify: vi.fn(),
  thread: vi.fn(),
  record: vi.fn(),
  sendText: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: async () => (m.role ? { user: { role: m.role, id: "a1", name: "Sam" } } : null) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { booking: { findUnique: m.booking }, activityLog: { findMany: m.logs, create: m.create } } }));
vi.mock("@/lib/notifications/service", () => ({ notify: m.notify }));
vi.mock("@/lib/whatsapp-inbox-store", () => ({ loadThread: m.thread, recordOutbound: m.record }));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsAppTextResult: m.sendText }));

import { POST } from "@/app/api/admin/bookings/[id]/message/route";
import { confirmationFields } from "@/lib/whatsapp-messages";
import { TEMPLATE_DEFS, renderTemplate } from "@/lib/whatsapp-template-defs";

/**
 * "Send to phone" must get the booking to the customer even while Meta will not
 * take the business-started template (not approved yet, and the account has no
 * payment method). It tries a normal message if the customer wrote in the last
 * 24 hours, and otherwise hands back a link that opens the office's own WhatsApp
 * with the confirmation ready.
 */

const booking = {
  id: "b1", confirmationCode: "EBC-9", status: "CONFIRMED", userId: null, guestPhone: "+34 600 123 456", guestName: "Ana Smith", guestEmail: "a@b.com",
  pickupAddress: "Barcelona Airport T1", dropoffAddress: "Hotel Arts", pickupDatetime: new Date("2026-10-10T10:00:00Z"), passengers: 2, luggage: 1,
  vehicleClass: "BUSINESS", flightNumber: null, specialRequests: null, totalAmount: 95, paymentStatus: "PAID", paymentMethod: "CARD_LINK",
  depositAmount: null, balanceAmount: null, balancePaidAt: null, driverAmount: null, driver: null,
};
const req = (body: unknown) => new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) as never;
const ctx = { params: Promise.resolve({ id: "b1" }) };

beforeEach(() => {
  m.role = "ADMIN";
  for (const f of [m.booking, m.logs, m.create, m.notify, m.thread, m.record, m.sendText]) f.mockReset();
  m.booking.mockResolvedValue(booking);
  m.logs.mockResolvedValue([]);
  m.create.mockResolvedValue({});
  m.thread.mockResolvedValue({ canReplyFreely: false });
  m.record.mockResolvedValue(undefined);
});

describe("renderTemplate", () => {
  const def = TEMPLATE_DEFS.find((t) => t.event === "BOOKING_CONFIRMED")!;

  it("fills every slot, in order, from the booking", () => {
    const text = renderTemplate(def, confirmationFields(booking as never));
    expect(text).not.toMatch(/\{\{|\}\}/);
    expect(text).toContain("EBC-9");
    expect(text).toContain("Ana Smith");
    expect(text).toContain("€95");
    expect(text).toContain("Paid in full");
    expect(text.startsWith("✨ *ELITEBCN | PREMIUM TRANSFER BOOKING* ✨")).toBe(true);
  });

  it("puts a dash where a field is missing rather than the slot", () => {
    expect(renderTemplate({ body: "A {{1}} B {{2}} C", fields: ["x"] }, { x: "one" })).toBe("A one B - C");
  });
});

describe("Send to phone, WhatsApp", () => {
  it("is for admins only", async () => {
    m.role = "DRIVER";
    expect((await POST(req({ channels: ["whatsapp"] }), ctx)).status).toBe(401);
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("changes nothing when the template is sent", async () => {
    m.notify.mockResolvedValue({ results: { whatsapp: { outcome: "sent" } } });
    const body = await (await POST(req({ channels: ["whatsapp"] }), ctx)).json();
    expect(body.results.whatsapp.outcome).toBe("sent");
    expect(body.whatsappLink).toBeNull();
    expect(m.sendText).not.toHaveBeenCalled();
  });

  it("sends the confirmation as a normal message when the customer wrote in the last 24 hours", async () => {
    m.notify.mockResolvedValue({ results: { whatsapp: { outcome: "failed", reason: "the template does not exist, or is not approved yet" } } });
    m.thread.mockResolvedValue({ canReplyFreely: true });
    m.sendText.mockResolvedValue({ outcome: "sent", id: "wamid.1" });
    const body = await (await POST(req({ channels: ["whatsapp"] }), ctx)).json();
    expect(m.sendText.mock.calls[0][0]).toBe("+34600123456");
    expect(m.sendText.mock.calls[0][1]).toContain("EBC-9");
    expect(m.record).toHaveBeenCalledWith(expect.objectContaining({ phone: "+34600123456", wamid: "wamid.1", by: "Sam" }));
    expect(body.results.whatsapp.outcome).toBe("sent");
    expect(body.whatsappLink).toBeNull();
  });

  it("hands back a wa.me link with the confirmation ready when the customer has not written", async () => {
    m.notify.mockResolvedValue({ results: { whatsapp: { outcome: "failed", reason: "the template does not exist, or is not approved yet" } } });
    const body = await (await POST(req({ channels: ["whatsapp"] }), ctx)).json();
    expect(m.sendText).not.toHaveBeenCalled();
    expect(body.results.whatsapp.outcome).toBe("failed");
    const url = new URL(body.whatsappLink);
    expect(url.origin + url.pathname).toBe("https://wa.me/34600123456");
    const text = url.searchParams.get("text")!;
    expect(text).toContain("EBC-9");
    expect(text).toContain("BOOKING CONFIRMATION DETAILS");
    expect(text).not.toContain("{{");
  });

  it("falls back to the link when a normal message is refused too", async () => {
    m.notify.mockResolvedValue({ results: { whatsapp: { outcome: "failed", reason: "x" } } });
    m.thread.mockResolvedValue({ canReplyFreely: true });
    m.sendText.mockResolvedValue({ outcome: "failed", reason: "refused" });
    const body = await (await POST(req({ channels: ["whatsapp"] }), ctx)).json();
    expect(body.whatsappLink).toMatch(/^https:\/\/wa\.me\/34600123456\?text=/);
  });

  it("offers no link for a text-only send", async () => {
    m.notify.mockResolvedValue({ results: { sms: { outcome: "sent" } } });
    expect((await (await POST(req({ channels: ["sms"] }), ctx)).json()).whatsappLink).toBeNull();
  });
});
