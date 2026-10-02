import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_URL } from "@/lib/seo";
import {
  twilioSignature,
  validTwilioSignature,
  candidateWebhookUrls,
  deliveryErrorText,
  isFinalSmsStatus,
} from "@/lib/twilio-webhook";

/**
 * Delivery receipts and customer replies.
 *
 * Both are public URLs that move data into the booking record, so the thing
 * that matters most is that a request not signed by Twilio does nothing at all.
 * Network and database are mocked; no message is sent.
 */

const ROOT = join(__dirname, "..", "..");

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  findBooking: vi.fn(),
  notifyAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityLog: { create: mocks.create, findFirst: mocks.findFirst },
    booking: { findFirst: mocks.findBooking },
  },
}));
vi.mock("@/lib/whatsapp", () => ({ notifyAdmin: mocks.notifyAdmin }));

const TOKEN = "test-token";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_AUTH_TOKEN", TOKEN);
  mocks.create.mockResolvedValue({});
  mocks.findFirst.mockResolvedValue(null);
  mocks.findBooking.mockResolvedValue(null);
  mocks.notifyAdmin.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

function signed(path: string, params: Record<string, string>, token = TOKEN) {
  const url = `${BASE_URL}${path}`;
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": twilioSignature(url, params, token),
    },
    body: new URLSearchParams(params).toString(),
  });
}

describe("the signature", () => {
  /** The example in Twilio's own documentation, so this is checked against them and not only against us. */
  it("matches the worked example Twilio publishes", () => {
    const sig = twilioSignature(
      "https://mycompany.com/myapp.php?foo=1&bar=2",
      { CallSid: "CA1234567890ABCDE", Caller: "+14158675309", Digits: "1234", From: "+14158675309", To: "+18005551212" },
      "12345",
    );
    expect(sig).toBe("RSOYDt4T1cUTdK1PDd93/VVr8B8=");
  });

  it("accepts the right signature and refuses a wrong or missing one", () => {
    const url = "https://www.elitebcn.info/x";
    const p = { A: "1", B: "2" };
    const good = twilioSignature(url, p, "tok");
    expect(validTwilioSignature([url], p, good, "tok")).toBe(true);
    expect(validTwilioSignature([url], { ...p, B: "3" }, good, "tok")).toBe(false);
    expect(validTwilioSignature([url], p, "nope", "tok")).toBe(false);
    expect(validTwilioSignature([url], p, null, "tok")).toBe(false);
  });

  /** "Cannot verify" must never read as "fine". */
  it("refuses everything when there is no token to check against", () => {
    const url = "https://www.elitebcn.info/x";
    const sig = twilioSignature(url, {}, "tok");
    expect(validTwilioSignature([url], {}, sig, undefined)).toBe(false);
    expect(validTwilioSignature([url], {}, sig, "")).toBe(false);
  });

  it("tries the configured address with and without www", () => {
    const urls = candidateWebhookUrls("/api/twilio/status?booking=b1", "http://internal/api/twilio/status?booking=b1");
    expect(urls).toContain(`${BASE_URL}/api/twilio/status?booking=b1`);
    expect(urls.some((u) => u.startsWith("https://elitebcn.info/"))).toBe(true);
    expect(urls.some((u) => u.startsWith("https://www.elitebcn.info/"))).toBe(true);
  });
});

describe("what a delivery problem means", () => {
  it("says it in words, and does not invent one for a code it does not know", () => {
    expect(deliveryErrorText("30006")).toMatch(/landline/);
    expect(deliveryErrorText("30003")).toMatch(/off or out of coverage/);
    expect(deliveryErrorText("99999")).toBe("Twilio error 99999");
    expect(deliveryErrorText(null)).toBeNull();
    expect(deliveryErrorText("")).toBeNull();
  });

  it("knows when a text has stopped changing", () => {
    expect(isFinalSmsStatus("delivered")).toBe(true);
    expect(isFinalSmsStatus("undelivered")).toBe(true);
    expect(isFinalSmsStatus("sent")).toBe(false);
  });
});

describe("the delivery receipt", () => {
  it("files a verified receipt against the booking", async () => {
    const { POST } = await import("@/app/api/twilio/status/route");
    const res = await POST(signed("/api/twilio/status?booking=bk1", { MessageSid: "SM1", MessageStatus: "delivered", To: "+34635383712" }));
    expect(res.status).toBe(204);
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.action).toBe("SMS_DELIVERY");
    expect(data.entityId).toBe("bk1");
    expect(data.details).toMatchObject({ sid: "SM1", status: "delivered", errorCode: null, to: "…3712" });
  });

  it("records the error code when it did not arrive", async () => {
    const { POST } = await import("@/app/api/twilio/status/route");
    await POST(signed("/api/twilio/status?booking=bk1", { MessageSid: "SM2", MessageStatus: "undelivered", ErrorCode: "30006" }));
    expect(mocks.create.mock.calls[0][0].data.details.errorCode).toBe("30006");
  });

  it("does nothing for a request that Twilio did not sign", async () => {
    const { POST } = await import("@/app/api/twilio/status/route");
    const forged = signed("/api/twilio/status?booking=bk1", { MessageSid: "SM1", MessageStatus: "delivered" }, "someone-elses-token");
    expect((await POST(forged)).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does nothing when the site has no token to verify with", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    const { POST } = await import("@/app/api/twilio/status/route");
    expect((await POST(signed("/api/twilio/status?booking=bk1", { MessageSid: "SM1", MessageStatus: "delivered" }))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("ignores a status it does not know, and a receipt with no booking", async () => {
    const { POST } = await import("@/app/api/twilio/status/route");
    await POST(signed("/api/twilio/status?booking=bk1", { MessageSid: "SM1", MessageStatus: "banana" }));
    await POST(signed("/api/twilio/status", { MessageSid: "SM1", MessageStatus: "delivered" }));
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("a customer reply", () => {
  const reply = (body: string, from = "+34635383712") =>
    signed("/api/twilio/inbound", { From: from, To: "+447455731577", Body: body, MessageSid: "SMr1" });

  it("is filed on the customer's booking and forwarded to the office", async () => {
    mocks.findBooking.mockResolvedValue({ id: "bk1", confirmationCode: "ABC123", guestName: "Aaron", pickupAddress: "T1", pickupDatetime: new Date() });
    const { POST } = await import("@/app/api/twilio/inbound/route");
    const res = await POST(reply("Where is my driver?"));
    expect(res.status).toBe(200);

    const logged = mocks.create.mock.calls.map((c) => c[0].data);
    expect(logged[0]).toMatchObject({ action: "SMS_REPLY", entity: "Booking", entityId: "bk1" });
    expect(logged[0].details.body).toBe("Where is my driver?");

    const text = mocks.notifyAdmin.mock.calls[0][0] as string;
    expect(text).toContain("ABC123");
    expect(text).toContain("Where is my driver?");
    expect(text).toContain("Aaron");
  });

  it("is still forwarded when no booking matches the number", async () => {
    const { POST } = await import("@/app/api/twilio/inbound/route");
    await POST(reply("hello?"));
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ action: "SMS_REPLY", entity: "Inbound", entityId: null });
    expect(mocks.notifyAdmin.mock.calls[0][0]).toContain("No booking is linked");
  });

  it("answers once, with where a person can be reached", async () => {
    const { POST } = await import("@/app/api/twilio/inbound/route");
    const xml = await (await POST(reply("hello?"))).text();
    expect(xml).toContain("<Message>");
    expect(xml).toContain("+34635383712");
    expect(mocks.create.mock.calls.map((c) => c[0].data.action)).toContain("SMS_AUTOREPLY");
  });

  it("does not answer a second time inside a day", async () => {
    mocks.findFirst.mockResolvedValue({ id: "earlier" });
    const { POST } = await import("@/app/api/twilio/inbound/route");
    const xml = await (await POST(reply("hello again?"))).text();
    expect(xml).not.toContain("<Message>");
    // The reply itself is still kept and forwarded.
    expect(mocks.notifyAdmin).toHaveBeenCalled();
  });

  /** STOP is the carrier's to handle; answering it would be a text to someone who asked for none. */
  it("leaves STOP and the other opt-out words alone", async () => {
    const { POST } = await import("@/app/api/twilio/inbound/route");
    for (const word of ["STOP", "stop", " Unsubscribe ", "HELP", "start"]) {
      const res = await POST(reply(word));
      expect(await res.text(), word).not.toContain("<Message>");
    }
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.notifyAdmin).not.toHaveBeenCalled();
  });

  it("does nothing for a request that Twilio did not sign", async () => {
    const { POST } = await import("@/app/api/twilio/inbound/route");
    const forged = signed("/api/twilio/inbound", { From: "+34600000000", Body: "hi" }, "someone-elses-token");
    expect((await POST(forged)).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.notifyAdmin).not.toHaveBeenCalled();
  });
});

describe("a text asks for its receipt", () => {
  it("passes the booking to Twilio as a status callback, and only when there is one", () => {
    const sms = readFileSync(join(ROOT, "lib/sms.ts"), "utf-8");
    expect(sms).toContain('form.set("StatusCallback"');
    expect(sms).toContain("/api/twilio/status?booking=");
    expect(sms).toMatch(/if \(opts\.bookingId\)/);
    expect(readFileSync(join(ROOT, "lib/notifications/service.ts"), "utf-8")).toContain("sendSms(input.phone, text, { bookingId: input.bookingId })");
  });
});
