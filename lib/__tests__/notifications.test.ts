import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  copyFor,
  resolveLocale,
  EVENT_DEFS,
  NOTIFICATION_EVENTS,
} from "@/lib/notifications/events";

describe("notification copy", () => {
  it("defines all four locales for every event", () => {
    for (const event of NOTIFICATION_EVENTS) {
      for (const locale of ["en", "es", "fr", "de"] as const) {
        const c = EVENT_DEFS[event].copy[locale];
        expect(c?.title, `${event}.${locale}.title`).toBeTruthy();
        expect(c?.body, `${event}.${locale}.body`).toBeTruthy();
      }
    }
  });

  it("declares at least one channel for every event", () => {
    for (const event of NOTIFICATION_EVENTS) {
      expect(EVENT_DEFS[event].channels.length, event).toBeGreaterThan(0);
    }
  });

  it("substitutes placeholders", () => {
    expect(render("Booking {{code}} on {{when}}", { code: "ABC1", when: "Fri" }))
      .toBe("Booking ABC1 on Fri");
  });

  it("never leaks a raw placeholder when a var is missing", () => {
    // A customer must never receive a message containing literal {{code}}.
    const out = render("Your transfer {{code}} on {{when}} is confirmed. {{route}}", { code: "ABC1" });
    expect(out).not.toMatch(/\{\{/);
    expect(out).toBe("Your transfer ABC1 on is confirmed.");
  });

  it("coerces numbers, including zero", () => {
    expect(render("€{{amount}}", { amount: 0 })).toBe("€0");
    expect(render("€{{amount}}", { amount: 65 })).toBe("€65");
  });

  it("falls back to English for an unsupported language", () => {
    expect(resolveLocale("it")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale("ES")).toBe("es");
    expect(resolveLocale("de-DE")).toBe("de");
  });

  it("renders localised copy", () => {
    expect(copyFor("BOOKING_CONFIRMED", "es", { code: "X1", when: "1 sep", route: "BCN → Sitges" }).title)
      .toBe("Reserva confirmada");
    expect(copyFor("BOOKING_CONFIRMED", "de", { code: "X1" }).title)
      .toBe("Buchung bestätigt");
  });
});

// --- dispatcher ------------------------------------------------------------
// prisma and whatsapp are mocked so the suite never touches the live database
// or the Meta API.

const created: unknown[] = [];
const audits: unknown[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { create: vi.fn(async ({ data }: any) => { created.push(data); return data; }) },
    activityLog:  { create: vi.fn(async ({ data }: any) => { audits.push(data); return data; }) },
  },
}));

const sendWhatsAppText = vi.fn(async () => true);
vi.mock("@/lib/whatsapp", () => ({ sendWhatsAppText: (...a: unknown[]) => sendWhatsAppText(...(a as [])) }));

describe("notify()", () => {
  beforeEach(() => {
    created.length = 0;
    audits.length = 0;
    sendWhatsAppText.mockClear();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("WA_PHONE_ID", "123");
    vi.stubEnv("WA_TOKEN", "tok");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("writes an in-app row and an audit entry", async () => {
    const { notify } = await import("@/lib/notifications/service");
    const res = await notify({
      event: "BOOKING_CONFIRMED",
      channels: ["inapp"],
      userId: "user_1",
      bookingId: "bk_1",
      vars: { code: "ABC1", when: "1 Sep", route: "BCN → Sitges" },
    });

    expect(res.results.inapp.outcome).toBe("sent");
    expect(created).toHaveLength(1);
    expect((created[0] as any).userId).toBe("user_1");
    expect((created[0] as any).type).toBe("BOOKING_CONFIRMED");
    expect((created[0] as any).data.bookingId).toBe("bk_1");
    expect(audits).toHaveLength(1);
  });

  it("skips in-app for a guest booking rather than failing", async () => {
    const { notify } = await import("@/lib/notifications/service");
    const res = await notify({ event: "BOOKING_CONFIRMED", channels: ["inapp"], userId: null });
    expect(res.results.inapp.outcome).toBe("skipped");
    expect(created).toHaveLength(0);
  });

  it("reports a failing email channel without throwing", async () => {
    const { notify } = await import("@/lib/notifications/service");
    const res = await notify({
      event: "PAYMENT_RECEIVED",
      channels: ["email"],
      email: async () => { throw new Error("resend 500"); },
    });
    expect(res.results.email.outcome).toBe("failed");
    expect(res.results.email.reason).toContain("resend 500");
  });

  it("distinguishes an unconfigured channel from a broken one", async () => {
    vi.stubEnv("WA_PHONE_ID", "");
    vi.stubEnv("WA_TOKEN", "");
    const { notify } = await import("@/lib/notifications/service");
    const res = await notify({
      event: "PICKUP_REMINDER",
      channels: ["whatsapp"],
      phone: "+34600000000",
    });
    expect(res.results.whatsapp.outcome).toBe("skipped");
    expect(res.results.whatsapp.reason).toContain("not configured");
    expect(sendWhatsAppText).not.toHaveBeenCalled();
  });

  it("treats a closed WhatsApp session window as skipped, not failed", async () => {
    sendWhatsAppText.mockResolvedValueOnce(false);
    const { notify } = await import("@/lib/notifications/service");
    const res = await notify({
      event: "PICKUP_REMINDER",
      channels: ["whatsapp"],
      phone: "+34600000000",
    });
    expect(res.results.whatsapp.outcome).toBe("skipped");
    expect(res.results.whatsapp.reason).toMatch(/24h/);
  });

  it("uses the event's default channels when none are given", async () => {
    const { notify } = await import("@/lib/notifications/service");
    const res = await notify({ event: "RIDE_COMPLETED", userId: "u1", vars: { code: "Z9" } });
    // RIDE_COMPLETED is in-app only.
    expect(Object.keys(res.results)).toEqual(["inapp"]);
  });
});

describe("flight delay reaches everyone who needs it", () => {
  it("has distinct copy for the customer and the driver", () => {
    const cust   = copyFor("FLIGHT_DELAYED",        "en", { flight: "VY1875", when: "8 Aug 14:30" });
    const driver = copyFor("FLIGHT_DELAYED_DRIVER", "en", {
      flight: "VY1875", when: "8 Aug 14:30", code: "ABC12345",
      passenger: "J Smith", pickup: "Terminal 1",
    });

    // The customer is reassured; the driver is instructed. Sending the
    // customer's "no action needed" to a driver would tell them to ignore a
    // pickup that has moved.
    expect(cust.body).toMatch(/no action needed/i);
    expect(driver.body).not.toMatch(/no action needed/i);
    expect(driver.body).toMatch(/Collect from Terminal 1/);
    expect(driver.title).toMatch(/Pickup moved/);
  });

  it("gives the driver the details needed to act: who, where, when", () => {
    const d = copyFor("FLIGHT_DELAYED_DRIVER", "en", {
      flight: "IB3456", when: "9 Aug 07:15", code: "XY99",
      passenger: "A Garcia", pickup: "Terminal 2 Arrivals",
    });
    expect(d.body).toContain("A Garcia");
    expect(d.body).toContain("Terminal 2 Arrivals");
    expect(d.body).toContain("9 Aug 07:15");
    expect(d.body).toContain("XY99");
  });

  it("does not email the driver — they need it on their phone", () => {
    // A driver on the road reads WhatsApp and push, not email.
    expect(EVENT_DEFS.FLIGHT_DELAYED_DRIVER.channels).toEqual(["inapp", "whatsapp", "push"]);
    expect(EVENT_DEFS.FLIGHT_DELAYED.channels).toContain("email");
  });

  it("defines driver copy in all four languages", () => {
    for (const l of ["en", "es", "fr", "de"] as const) {
      const c = EVENT_DEFS.FLIGHT_DELAYED_DRIVER.copy[l];
      expect(c?.title, l).toBeTruthy();
      expect(c?.body, l).toBeTruthy();
    }
  });
});
