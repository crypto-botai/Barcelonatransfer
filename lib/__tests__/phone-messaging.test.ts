import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { smsTextFor, SMS_EVENTS } from "@/lib/notifications/sms-copy";
import { smsSegments } from "@/lib/sms";
import { EVENT_DEFS, type Locale, type NotificationEvent } from "@/lib/notifications/events";
import { WHATSAPP_TEMPLATES, whatsappTemplateFor } from "@/lib/notifications/whatsapp-templates";
import { sendWhatsAppTemplate, sendWhatsAppText, templateField } from "@/lib/whatsapp";

/**
 * Putting a booking on a customer's phone, by text and by WhatsApp.
 *
 * Covers the three ways this goes quietly wrong:
 *
 *   - a message that costs three times what it should because of one
 *     character, or that is cut off in the middle of an address;
 *   - a WhatsApp message sent as free text to a customer who has not written to
 *     us in a day, which Meta refuses and the audit log files as "skipped";
 *   - a template whose slots are filled from a variable the caller never
 *     passed, which Meta fills with a dash and nobody notices.
 *
 * The network is mocked. Nothing here sends a real message.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const VARS = {
  code: "PRB6PY9KU7",
  when: "Sat 3 Oct, 01:30",
  route: "Terminal 1, Barcelona El Prat Airport BCN → Carrer de la Independència, Sant Martí, Barcelona, Catalonia",
  driver: "Mohamed Al-Sayed",
  flight: "VY8465",
  link: "https://www.elitebcn.info/track/PRB6PY9KU7",
};

describe("what the text says", () => {
  const LOCALES: Locale[] = ["en", "es", "fr", "de"];

  it("has wording in every language for every event that sends a text", () => {
    for (const event of SMS_EVENTS) {
      for (const locale of LOCALES) {
        const t = smsTextFor(event, locale, VARS);
        expect(t, `${event}/${locale}`).toBeTruthy();
      }
    }
  });

  it("never leaves a raw placeholder in front of a customer", () => {
    for (const event of SMS_EVENTS) {
      for (const locale of LOCALES) {
        expect(smsTextFor(event, locale, {})!, `${event}/${locale}`).not.toMatch(/\{\{|\}\}/);
      }
    }
  });

  /**
   * Cost. Two segments is the ceiling for a message with a long address in it;
   * a message with only a code and a time should be one.
   */
  it("stays within two segments even with a long address", () => {
    for (const event of SMS_EVENTS) {
      for (const locale of LOCALES) {
        const t = smsTextFor(event, locale, VARS)!;
        expect(smsSegments(t), `${event}/${locale}: ${t.length} chars`).toBeLessThanOrEqual(2);
      }
    }
  });

  /** Anything outside the GSM alphabet is billed at 70 characters a segment. */
  it("contains no character that forces the expensive encoding", () => {
    for (const event of SMS_EVENTS) {
      for (const locale of LOCALES) {
        const t = smsTextFor(event, locale, VARS)!;
        // The em dash, the arrow, the curly quote and the accents GSM lacks.
        expect(t, `${event}/${locale}`).not.toMatch(/[—–→‘’“”áíóúç]/);
      }
    }
  });

  it("cuts a long address at a word instead of mid-street", () => {
    const t = smsTextFor("BOOKING_CONFIRMED", "en", { ...VARS, route: "x ".repeat(100) })!;
    expect(t).toContain("...");
    // The link survives, and so does the line saying where to get an answer.
    expect(t).toContain(VARS.link);
    expect(t).toContain("+34635383712");
  });

  it("puts the tracking link before the no-reply line, and only when there is one", () => {
    const withLink = smsTextFor("DRIVER_ASSIGNED", "en", VARS)!;
    expect(withLink).toMatch(/Track: https:\/\/www\.elitebcn\.info\/track\/PRB6PY9KU7 Do not reply/);

    const without = smsTextFor("DRIVER_ASSIGNED", "en", { ...VARS, link: "" })!;
    expect(without).not.toMatch(/Track/);
  });

  it("names the code and the time, which is what a customer needs from it", () => {
    const t = smsTextFor("BOOKING_CONFIRMED", "en", VARS)!;
    expect(t).toContain("PRB6PY9KU7");
    expect(t).toContain("Sat 3 Oct, 01:30");
  });

  it("sends nothing for an event that is not worth a text", () => {
    for (const event of ["REVIEW_REQUEST", "RIDE_COMPLETED", "PAYMENT_RECEIVED", "DRIVER_NEW_JOB"] as NotificationEvent[]) {
      expect(smsTextFor(event, "en", VARS), event).toBeNull();
    }
  });

  it("sends a text on exactly two events, and on no event by default", () => {
    expect([...SMS_EVENTS].sort()).toEqual(["BOOKING_CONFIRMED", "DRIVER_ASSIGNED"]);
    // A text is sent only when a caller asks for it for a customer who paid, so
    // no event may carry it in its default channels.
    for (const event of Object.keys(EVENT_DEFS) as NotificationEvent[]) {
      expect(EVENT_DEFS[event].channels, event).not.toContain("sms");
    }
    // And the reminder and the flight notice have no wording to send at all.
    expect(smsTextFor("PICKUP_REMINDER", "en", VARS)).toBeNull();
    expect(smsTextFor("FLIGHT_DELAYED", "en", VARS)).toBeNull();
  });
});

describe("what goes in a WhatsApp template", () => {
  it("makes a field safe for Meta, which rejects empty ones and line breaks", () => {
    expect(templateField("")).toBe("-");
    expect(templateField(null)).toBe("-");
    expect(templateField("Terminal 1\nBarcelona")).toBe("Terminal 1, Barcelona");
    expect(templateField("a    b")).toBe("a b");
    expect(templateField("x".repeat(2000)).length).toBe(1000);
    expect(templateField(65)).toBe("65");
  });

  it("keeps the confirmation template under the name it has always had", () => {
    vi.stubEnv("WA_TEMPLATE_BOOKING_CONFIRMED", "");
    expect(whatsappTemplateFor("BOOKING_CONFIRMED")).toEqual({ name: "booking_confirmation", fields: ["code", "when", "route"] });
    vi.unstubAllEnvs();
  });

  /** Opt-in: nothing is sent as a template that nobody has created in Meta. */
  it("uses a template for the other messages only once its name is set", () => {
    vi.stubEnv("WA_TEMPLATE_PICKUP_REMINDER", "");
    expect(whatsappTemplateFor("PICKUP_REMINDER")).toBeNull();
    vi.stubEnv("WA_TEMPLATE_PICKUP_REMINDER", "pickup_reminder");
    expect(whatsappTemplateFor("PICKUP_REMINDER")).toEqual({ name: "pickup_reminder", fields: ["code", "when", "route"] });
    vi.unstubAllEnvs();
  });

  it("gives the office wording to submit, with one placeholder per field", () => {
    for (const [event, spec] of Object.entries(WHATSAPP_TEMPLATES)) {
      const placeholders = spec!.suggestedText.match(/\{\{\d+\}\}/g) ?? [];
      expect(placeholders.length, event).toBe(spec!.fields.length);
      // Numbered in order, from 1: Meta fills them by position.
      placeholders.forEach((p, i) => expect(p, event).toBe(`{{${i + 1}}}`));
      // Meta rejects a template that begins or ends with a variable.
      expect(spec!.suggestedText.startsWith("{{"), event).toBe(false);
      expect(spec!.suggestedText.endsWith("}}"), event).toBe(false);
    }
  });

  /**
   * A field filled from a variable the caller never passes is filled with a
   * dash, and the customer reads "Your driver is -". Every call site has to
   * pass every field its event's template uses.
   */
  const CALLERS: Array<[NotificationEvent, string, string]> = [
    ["BOOKING_CONFIRMED", "lib/payment-completion.ts", 'event:     "BOOKING_CONFIRMED"'],
    ["BOOKING_CONFIRMED", "app/api/admin/bookings/route.ts", 'event:     "BOOKING_CONFIRMED"'],
    ["BOOKING_CONFIRMED", "app/api/admin/bookings/[id]/message/route.ts", 'event: "BOOKING_CONFIRMED"'],
    ["PICKUP_REMINDER",   "app/api/cron/pickup-reminder/route.ts", 'event:     "PICKUP_REMINDER"'],
    ["DRIVER_ASSIGNED",   "app/api/bookings/[id]/route.ts", 'event:     "DRIVER_ASSIGNED"'],
    ["DRIVER_ASSIGNED",   "lib/partner.ts", 'event: "DRIVER_ASSIGNED"'],
    ["FLIGHT_DELAYED",    "lib/flights/sweep.ts", 'event:     "FLIGHT_DELAYED"'],
  ];

  it.each(CALLERS)("%s passes every template field (%s)", (event, file, marker) => {
    const src = rd(file);
    const at = src.indexOf(marker);
    expect(at, `${file} has no ${event} notification`).toBeGreaterThan(-1);
    // The call, up to the end of its vars.
    const call = src.slice(at, at + 900);
    for (const field of WHATSAPP_TEMPLATES[event]!.fields) {
      expect(call, `${file} does not pass "${field}" for ${event}`).toMatch(new RegExp(`\\b${field}\\s*[:,}]`));
    }
  });
});

describe("the WhatsApp request", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("WA_PHONE_ID", "1234567890");
    vi.stubEnv("WA_TOKEN", "tok");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  const ok = () => ({ ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.X" }] }), text: async () => "" });
  const err = (code: number, message = "m") => ({ ok: false, status: 400, json: async () => ({}), text: async () => JSON.stringify({ error: { code, message } }) });

  it("posts a template with its fields in order", async () => {
    fetchMock.mockResolvedValue(ok());
    const r = await sendWhatsAppTemplate("+34635383712", "booking_confirmation", ["ABC", "Sat 3 Oct", "A to B"]);
    expect(r).toEqual({ outcome: "sent", id: "wamid.X" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/1234567890/messages");
    expect(init.headers.Authorization).toBe("Bearer tok");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ messaging_product: "whatsapp", to: "+34635383712", type: "template" });
    expect(body.template.name).toBe("booking_confirmation");
    expect(body.template.language.code).toBe("en");
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual(["ABC", "Sat 3 Oct", "A to B"]);
  });

  it("does not send to a number with no country code", async () => {
    const r = await sendWhatsAppTemplate("07911 123456", "t", ["a"]);
    expect(r.outcome).toBe("skipped");
    expect(r.reason).toMatch(/country code/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports unconfigured without touching the network", async () => {
    vi.stubEnv("WA_TOKEN", "");
    const r = await sendWhatsAppTemplate("+34635383712", "t", ["a"]);
    expect(r.outcome).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /** Each of these is a different thing to fix, so each says which. */
  it.each([
    [190,    "failed",  /token/i],
    [132001, "failed",  /template does not exist|not approved/i],
    [132000, "failed",  /wrong number of fields/i],
    [131030, "failed",  /test mode/i],
    [131042, "failed",  /payment/i],
    [131026, "skipped", /not on WhatsApp/i],
  ])("explains Meta error %i", async (code, outcome, reason) => {
    fetchMock.mockResolvedValue(err(code));
    const r = await sendWhatsAppTemplate("+34635383712", "t", ["a"]);
    expect(r.outcome).toBe(outcome);
    expect(r.reason).toMatch(reason);
  });

  it("never throws when the network does", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const r = await sendWhatsAppTemplate("+34635383712", "t", ["a"]);
    expect(r.outcome).toBe("failed");
    expect(r.reason).toContain("ECONNRESET");
  });

  it("treats a closed free-text window as not-sent rather than broken", async () => {
    fetchMock.mockResolvedValue(err(131047));
    expect(await sendWhatsAppText("+34635383712", "hello")).toBe(false);
  });

  it("still throws on a genuine failure of a free-text send", async () => {
    fetchMock.mockResolvedValue(err(190));
    await expect(sendWhatsAppText("+34635383712", "hello")).rejects.toThrow(/token/i);
  });

  it("no longer carries its own number converter that guesses", () => {
    const src = rd("lib/whatsapp.ts");
    expect(src).not.toMatch(/function toE164/);
    expect(src).toContain('from "@/lib/phone"');
  });
});

describe("the dispatcher, end to end", () => {
  const fetchMock = vi.fn();
  const audits: Array<{ details: { channels: Record<string, string> } }> = [];

  beforeEach(() => {
    audits.length = 0;
    fetchMock.mockReset();
    vi.resetModules();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("WA_PHONE_ID", "1234567890");
    vi.stubEnv("WA_TOKEN", "tok");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtest");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "secret");
    vi.stubEnv("TWILIO_FROM", "EliteBCN");
    vi.stubEnv("WA_TEMPLATE_PICKUP_REMINDER", "");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        notification: { create: vi.fn() },
        activityLog: { create: vi.fn(async ({ data }: { data: never }) => { audits.push(data); return data; }) },
        booking: { findUnique: vi.fn(async () => null) },
      },
    }));
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("twilio")
        ? { ok: true, status: 201, json: async () => ({ sid: "SM1" }) }
        : { ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.1" }] }), text: async () => "" },
    );
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.doUnmock("@/lib/prisma"); });

  it("puts a paid booking on the phone twice: as a WhatsApp template and as a text", async () => {
    const { notify } = await import("@/lib/notifications/service");
    const res = await notify({
      event: "BOOKING_CONFIRMED", channels: ["whatsapp", "sms"], bookingId: "bk1", phone: "+34635383712", vars: VARS,
    });
    expect(res.results.whatsapp.outcome).toBe("sent");
    expect(res.results.sms.outcome).toBe("sent");

    const wa = fetchMock.mock.calls.find((c) => String(c[0]).includes("graph.facebook"))!;
    expect(JSON.parse(wa[1].body).template.name).toBe("booking_confirmation");
    const sms = fetchMock.mock.calls.find((c) => String(c[0]).includes("twilio"))!;
    expect(new URLSearchParams(sms[1].body).get("Body")).toContain("PRB6PY9KU7");
  });

  /** The reason customers were not being reached. */
  it("sends a reminder as free text until its template is set, then as the template", async () => {
    const { notify } = await import("@/lib/notifications/service");
    await notify({ event: "PICKUP_REMINDER", channels: ["whatsapp"], phone: "+34635383712", vars: VARS });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).type).toBe("text");

    fetchMock.mockClear();
    vi.stubEnv("WA_TEMPLATE_PICKUP_REMINDER", "pickup_reminder");
    await notify({ event: "PICKUP_REMINDER", channels: ["whatsapp"], phone: "+34635383712", vars: VARS });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.type).toBe("template");
    expect(sent.template.name).toBe("pickup_reminder");
  });

  it("names a missing country code as the reason, not the 24-hour window", async () => {
    const { notify } = await import("@/lib/notifications/service");
    const res = await notify({ event: "BOOKING_CONFIRMED", channels: ["whatsapp", "sms"], phone: "07911 123456", vars: VARS });
    expect(res.results.whatsapp.outcome).toBe("skipped");
    expect(res.results.whatsapp.reason).toMatch(/country code/);
    expect(res.results.sms.reason).toMatch(/country code/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips quietly when neither is configured, and still records it", async () => {
    vi.stubEnv("WA_TOKEN", "");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    const { notify } = await import("@/lib/notifications/service");
    const res = await notify({ event: "BOOKING_CONFIRMED", channels: ["whatsapp", "sms"], bookingId: "bk1", phone: "+34635383712", vars: VARS });
    expect(res.results.whatsapp.outcome).toBe("skipped");
    expect(res.results.sms.outcome).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(audits[0].details.channels).toEqual({ whatsapp: "skipped", sms: "skipped" });
  });

  it("lets one channel fail without losing the other", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("twilio")
        ? { ok: true, status: 201, json: async () => ({ sid: "SM1" }) }
        : { ok: false, status: 400, json: async () => ({}), text: async () => JSON.stringify({ error: { code: 190, message: "expired" } }) },
    );
    const { notify } = await import("@/lib/notifications/service");
    const res = await notify({ event: "BOOKING_CONFIRMED", channels: ["whatsapp", "sms"], bookingId: "bk1", phone: "+34635383712", vars: VARS });
    expect(res.results.whatsapp.outcome).toBe("failed");
    expect(res.results.sms.outcome).toBe("sent");
  });

  it("does not text for an event that has no wording", async () => {
    const { notify } = await import("@/lib/notifications/service");
    const res = await notify({ event: "REVIEW_REQUEST", channels: ["sms"], phone: "+34635383712", vars: VARS });
    expect(res.results.sms.outcome).toBe("skipped");
    expect(res.results.sms.reason).toMatch(/no SMS wording/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("it is sent once, and only to people who should get it", () => {
  /**
   * The pickup reminder went out every hour for as long as a booking sat in the
   * window, because its once-only guard was looking for a row that was written
   * without the booking on it. A text is billed per message, so the same rule
   * matters more here than it did for email.
   */
  it("texts the reminder only after the email has gone and logged itself", () => {
    const cron = rd("app/api/cron/pickup-reminder/route.ts");
    const guard = cron.indexOf("if (alreadySent) continue;");
    const email = cron.indexOf("await sendPickupReminder(");
    const phone = cron.indexOf('event:     "PICKUP_REMINDER"');
    expect(guard).toBeGreaterThan(-1);
    expect(email).toBeGreaterThan(guard);
    // The text sits behind the email, so it inherits the guard and the log row.
    expect(phone).toBeGreaterThan(email);
    // The reminder is not texted: only the confirmation and the driver are.
    expect(cron).toMatch(/channels:\s*\["inapp", "whatsapp"\]/);
    expect(cron).not.toMatch(/channels:\s*\[[^\]]*"sms"/);
  });

  /** One booking, one confirmation, however many of the three paths race. */
  it("sends the paid confirmation inside the payment dedup guard", () => {
    const src = rd("lib/payment-completion.ts");
    const guard = src.indexOf("if (!alreadySent) {");
    const phone = src.indexOf('event:     "BOOKING_CONFIRMED"');
    const afterBlock = src.indexOf('return "confirmed";', phone);
    expect(guard).toBeGreaterThan(-1);
    expect(phone).toBeGreaterThan(guard);
    expect(afterBlock).toBeGreaterThan(phone);
    // And it is not also sent by a second, direct call.
    expect(src).not.toContain("sendWhatsAppBookingConfirmation");
  });

  it("does not text a customer who is not on a phone number that can be reached", () => {
    const svc = rd("lib/notifications/service.ts");
    expect(svc).toContain("number has no country code");
    expect(svc).toContain("no phone on booking");
  });
});

describe("the admin tools", () => {
  const send = rd("app/api/admin/bookings/[id]/message/route.ts");
  const status = rd("app/api/admin/messaging/route.ts");

  it("only let an admin send a booking to a phone", () => {
    expect(send).toContain('u.role !== "ADMIN"');
    expect(send).toMatch(/if \(!admin\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\)/);
    expect(status).toMatch(/u\?\.role !== "ADMIN"/);
  });

  it("refuse to call a cancelled booking confirmed", () => {
    expect(send).toContain('["CANCELLED", "REFUNDED"].includes(booking.status)');
    expect(send).toContain("{ status: 409 }");
  });

  it("refuse a booking with no phone", () => {
    expect(send).toContain("{ status: 422 }");
    expect(send).toMatch(/no phone number/i);
  });

  /** Pressing the button twice must not text the customer twice. */
  it("guard against a double click", () => {
    expect(send).toContain("DOUBLE_CLICK_MS");
    expect(send).toContain('action: "NOTIFY_BOOKING_CONFIRMED"');
    expect(send).toContain("{ status: 429 }");
  });

  it("use the same path, wording and audit trail as the automatic message", () => {
    expect(send).toContain('event: "BOOKING_CONFIRMED"');
    expect(send).toContain("notify({");
    expect(send).toContain('action: "SEND_BOOKING_TO_PHONE"');
  });

  /**
   * The status route is read by a screen to explain a greyed-out button. It
   * answers with booleans and template names, and nothing that could be used to
   * send a message or read an account.
   */
  it("never put a secret in the status response", () => {
    for (const secret of ["TWILIO_AUTH_TOKEN", "TWILIO_ACCOUNT_SID", "WA_TOKEN", "WA_PHONE_ID", "TWILIO_FROM\b.*NextResponse"]) {
      expect(status, secret).not.toMatch(new RegExp(secret));
    }
    // The only env reads are inside conditionals that return a label.
    expect(status).toMatch(/via: process\.env\.TWILIO_MESSAGING_SERVICE_SID \? "messaging-service"/);
  });

  it("add the phone to a booking made by hand only when asked, and through the picker", () => {
    const route = rd("app/api/admin/bookings/route.ts");
    expect(route).toMatch(/sendSms:\s+z\.boolean\(\)\.default\(false\)/);
    expect(route).toMatch(/sendWhatsApp:\s+z\.boolean\(\)\.default\(false\)/);

    const form = rd("app/admin/bookings/new/page.tsx");
    expect(form).toContain("<PhoneField");
    // Greyed out, and unchecked in what it posts, when the channel is off.
    expect(form).toMatch(/sendSms: sendSms && !!messaging\?\.sms\.configured/);
    expect(form).toMatch(/sendWhatsApp: sendWhatsApp && !!messaging\?\.whatsapp\.configured/);
  });

  it("show the office why a button is off, and the result of each send", () => {
    const page = rd("app/admin/bookings/page.tsx");
    expect(page).toContain("function PhoneSection(");
    expect(page).toContain("<PhoneSection booking={booking} />");
    expect(page).toMatch(/Twilio details are missing/);
    expect(page).toMatch(/Meta details are missing/);
    expect(page).toMatch(/Not sent: \$\{r\.reason\}/);
  });
});

describe("the office's own WhatsApp number", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("WA_PHONE_ID", "1234567890");
    vi.stubEnv("WA_TOKEN", "tok");
    vi.stubEnv("WA_ADMIN_NUMBER", "");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  /**
   * The number is stored the way a wa.me link wants it, "34635383712", with no
   * plus. Customer numbers must carry one; this one never has, and rejecting it
   * would have moved every office alert back to email when WhatsApp was turned
   * on, with nothing to say why.
   */
  it("reads the number the way it is actually stored", async () => {
    const { ownerNumber } = await import("@/lib/whatsapp");
    expect(ownerNumber("34635383712")).toBe("+34635383712");
    expect(ownerNumber("+34 635 383 712")).toBe("+34635383712");
    expect(ownerNumber("0034635383712")).toBe("+34635383712");
    expect(ownerNumber("")).toBeNull();
    expect(ownerNumber(undefined)).toBeNull();
    expect(ownerNumber("123")).toBeNull();
  });

  it("alerts the office on WhatsApp using that number", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "34635383712");
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ messages: [{ id: "x" }] }), text: async () => "" });
    const { notifyAdmin } = await import("@/lib/whatsapp");
    await notifyAdmin("New lead\nsomeone wants a car");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).to).toBe("+34635383712");
  });

  it("still holds a customer's number to the strict rule", async () => {
    const { sendWhatsAppTemplate } = await import("@/lib/whatsapp");
    const r = await sendWhatsAppTemplate("34635383712", "t", ["a"]);
    expect(r.outcome).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
