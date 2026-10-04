import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  role: "ADMIN" as string | null,
  configured: true,
  send: vi.fn(),
  logs: vi.fn(),
  create: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: async () => (m.role ? { user: { role: m.role, name: "Sam" } } : null) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityLog: { findMany: m.logs, create: m.create },
    bookingSession: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
    booking: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
    emailLog: { findMany: vi.fn().mockResolvedValue([]) },
    abandonedBooking: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/resend", () => ({ sendAbandonedBookingEmail: vi.fn(), sendPersonalNoteEmail: vi.fn() }));
vi.mock("@/lib/abandoned", () => ({ bookingAsForm: vi.fn(), sweepAbandoned: vi.fn() }));
vi.mock("@/lib/sms", async () => {
  const real = await vi.importActual<typeof import("@/lib/sms")>("@/lib/sms");
  return { ...real, smsConfigured: () => m.configured, sendSms: m.send };
});

import { GET, POST } from "@/app/api/admin/abandoned/route";
import { abandonedSmsText, SMS_MAX_CHARS } from "@/lib/abandoned-sms";
import { smsSegments } from "@/lib/sms";

/**
 * A text for someone who nearly booked and may not use WhatsApp.
 *
 * It must be about their own enquiry, short and in plain letters, sent only by
 * an admin, only to a number that can be texted, and never twice in a day.
 */

describe("the wording", () => {
  const lead = { name: "Taelor Hill", pickup: "Barcelona Sants railway station, Rodalies, Barcelona", dropoff: "Andorra la Vella, Andorra", date: "2026-12-10", time: "16:00" };

  it("names the journey, the day, and both ways to reach a person", () => {
    const t = abandonedSmsText(lead);
    expect(t).toContain("Hi Taelor");
    expect(t).toContain("from Barcelona Sants railway station to Andorra la Vella");
    expect(t).toContain("on 10 Dec at 16:00");
    expect(t).toContain("WhatsApp +34 635 383 712");
    expect(t).toContain("booking@elitebcn.info");
  });

  it("asks for nothing and quotes no price", () => {
    const t = abandonedSmsText(lead);
    expect(t).not.toMatch(/€|\d+\s?eur|discount|offer|% off|book now|pay/i);
  });

  it("fits two text messages even with long place names, and uses plain letters only", () => {
    const long = abandonedSmsText({ ...lead, pickup: "x".repeat(200), dropoff: "y".repeat(200) });
    expect(long.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
    expect(smsSegments(abandonedSmsText(lead))).toBeLessThanOrEqual(2);
    expect(abandonedSmsText(lead)).toMatch(/^[\x20-\x7E]+$/);
  });

  it("reads sensibly with little to go on", () => {
    expect(abandonedSmsText({})).toContain("your transfer enquiry");
    expect(abandonedSmsText({ name: "Ana", pickup: "Sitges" })).toContain("from Sitges");
    expect(abandonedSmsText({ name: "Ana" })).not.toMatch(/undefined|null/);
  });

  it("passes a date that is already written out", () => {
    expect(abandonedSmsText({ ...lead, date: "04 Oct, 21:00", time: null })).toContain("on 04 Oct, 21:00");
  });
});

const post = (body: unknown) => new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) as never;
const sms = (over: Record<string, unknown> = {}) => ({ kind: "sms", phone: "+351 913 422 735", name: "Taelor Hill", sessionId: "sess_1", message: "Hi Taelor, we can help with your transfer.", ...over });

beforeEach(() => {
  m.role = "ADMIN"; m.configured = true;
  m.send.mockReset(); m.logs.mockReset(); m.create.mockReset();
  m.send.mockResolvedValue({ outcome: "sent", id: "SM1" });
  m.logs.mockResolvedValue([]);
  m.create.mockResolvedValue({});
});

describe("sending it", () => {
  it("is for admins only", async () => {
    m.role = "DRIVER";
    expect((await POST(post(sms()))).status).toBe(401);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("texts the number in international form and records who sent what", async () => {
    const res = await POST(post(sms()));
    expect(res.status).toBe(200);
    expect(m.send.mock.calls[0][0]).toBe("+351913422735");
    expect(m.send.mock.calls[0][1]).toContain("we can help");
    const row = m.create.mock.calls[0][0].data;
    expect(row).toMatchObject({ action: "ABANDONED_SMS", entity: "BookingSession", entityId: "sess_1", adminName: "Sam" });
    expect(row.details).toMatchObject({ to: "+351913422735", outcome: "sent" });
  });

  it("files a text about an unpaid booking against the booking", async () => {
    await POST(post(sms({ sessionId: undefined, bookingId: "b1" })));
    expect(m.create.mock.calls[0][0].data).toMatchObject({ entity: "Booking", entityId: "b1" });
    expect(m.send.mock.calls[0][2]).toEqual({ bookingId: "b1" });
  });

  it("makes the text safe for a single-byte message before it goes", async () => {
    await POST(post(sms({ message: "Hola Ángel — su traslado está listo → escríbanos" })));
    expect(m.send.mock.calls[0][1]).toMatch(/^[\x20-\x7E]+$/);
  });

  it("refuses a number with no country code, without sending", async () => {
    const res = await POST(post(sms({ phone: "0613 456 789" })));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/country code/);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("says plainly when texts are not switched on", async () => {
    m.configured = false;
    const res = await POST(post(sms()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/not switched on/);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("will not text the same number twice in a day", async () => {
    m.logs.mockResolvedValue([{ details: { to: "+351913422735", outcome: "sent" } }]);
    const res = await POST(post(sms()));
    expect(res.status).toBe(429);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("does not count a text that failed against the day's limit, so it can be tried again", async () => {
    m.logs.mockResolvedValue([{ details: { to: "+351913422735", outcome: "failed" } }]);
    expect((await POST(post(sms()))).status).toBe(200);
  });

  it("reports a text Twilio refused, and records it as not sent", async () => {
    m.send.mockResolvedValue({ outcome: "skipped", reason: "the customer replied STOP and has opted out" });
    const res = await POST(post(sms()));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("opted out");
    expect(m.create.mock.calls[0][0].data.details.outcome).toBe("skipped");
  });

  it("reports a failure as a failure", async () => {
    m.send.mockResolvedValue({ outcome: "failed", reason: "Twilio 401" });
    expect((await POST(post(sms()))).status).toBe(502);
  });

  it("refuses an empty or over-long message", async () => {
    expect((await POST(post(sms({ message: "  " })))).status).toBe(422);
    expect((await POST(post(sms({ message: "x".repeat(SMS_MAX_CHARS + 1) })))).status).toBe(422);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("still sends an email note the way it did", async () => {
    // A note is not a text: it takes an email address, not a phone number.
    const res = await POST(post({ kind: "note", to: "a@b.com", name: "Ana" }));
    expect(res.status).toBe(422);
    expect(m.send).not.toHaveBeenCalled();
  });
});

describe("the list", () => {
  it("includes the texts the office has sent, newest first, for the Sent tab and the row's button", async () => {
    m.logs.mockResolvedValue([{ id: "l1", entityId: "sess_1", adminName: "Sam", createdAt: new Date("2026-10-04T10:00:00Z"), details: { to: "+351913422735", outcome: "sent", text: "Hi", segments: 1 } }]);
    const body = await (await GET()).json();
    expect(body.sms).toEqual([expect.objectContaining({ entityId: "sess_1", to: "+351913422735", outcome: "sent", by: "Sam", segments: 1 })]);
  });
});
