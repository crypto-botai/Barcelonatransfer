import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendSms, smsConfigured, toGsmSafe, smsSegments } from "@/lib/sms";

/**
 * A text to a customer's phone.
 *
 * Three things about SMS make it easy to get wrong in ways nobody notices
 * until the bill arrives or a customer complains:
 *
 *   - the number has to be complete. A text to "07911 123456" goes nowhere,
 *     and nothing in the response says why;
 *   - one character outside the GSM alphabet (an em dash, an arrow, a Spanish
 *     á) turns a 160-character message into 70-character segments, which is
 *     two to three times the price for the same words;
 *   - a customer who replies STOP, or a number that cannot receive texts, is
 *     not a fault in the integration, and reporting it as one buries the real
 *     faults.
 *
 * The network is mocked throughout. Nothing here can send a real message.
 */

const fetchMock = vi.fn();

function twilioOk(sid = "SMabc123") {
  return { ok: true, status: 201, json: async () => ({ sid }) };
}
function twilioError(status: number, code: number, message = "boom") {
  return { ok: false, status, json: async () => ({ code, message }) };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtest");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "secret");
  vi.stubEnv("TWILIO_FROM", "EliteBCN");
  vi.stubEnv("TWILIO_MESSAGING_SERVICE_SID", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("when SMS is not set up", () => {
  it("reports unconfigured without touching the network", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    expect(smsConfigured()).toBe(false);
    const r = await sendSms("+34600000000", "hi");
    expect(r.outcome).toBe("skipped");
    expect(r.reason).toMatch(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("needs a sender: a name, a number, or a messaging service", async () => {
    vi.stubEnv("TWILIO_FROM", "");
    expect(smsConfigured()).toBe(false);
    vi.stubEnv("TWILIO_MESSAGING_SERVICE_SID", "MG123");
    expect(smsConfigured()).toBe(true);
  });
});

describe("the number", () => {
  it("does not send to a number with no country code", async () => {
    const r = await sendSms("07911 123456", "hi");
    expect(r.outcome).toBe("skipped");
    expect(r.reason).toMatch(/country code/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not guess that a bare Spanish-looking number is Spanish", async () => {
    // 635383712 is a valid mobile in Spain and also a valid-looking one in
    // several other countries. A wrong guess texts a stranger.
    const r = await sendSms("635383712", "hi");
    expect(r.outcome).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says so when there is no number at all", async () => {
    expect((await sendSms(null, "hi")).reason).toMatch(/no phone/);
    expect((await sendSms("", "hi")).reason).toMatch(/no phone/);
  });

  it("normalises a formatted international number", async () => {
    fetchMock.mockResolvedValue(twilioOk());
    await sendSms("+34 635 383-712", "hi");
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(body.get("To")).toBe("+34635383712");
  });
});

describe("the request", () => {
  it("posts to the account's Messages endpoint with basic auth", async () => {
    fetchMock.mockResolvedValue(twilioOk());
    await sendSms("+34635383712", "hello");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("ACtest:secret").toString("base64")}`);
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });

  it("sends the text from the configured sender", async () => {
    fetchMock.mockResolvedValue(twilioOk());
    await sendSms("+34635383712", "hello there");
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(body.get("Body")).toBe("hello there");
    expect(body.get("From")).toBe("EliteBCN");
    expect(body.has("MessagingServiceSid")).toBe(false);
  });

  /** A Messaging Service picks the right sender per country; it should win. */
  it("uses the messaging service instead of a fixed sender when both are set", async () => {
    vi.stubEnv("TWILIO_MESSAGING_SERVICE_SID", "MG123");
    fetchMock.mockResolvedValue(twilioOk());
    await sendSms("+34635383712", "hi");
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(body.get("MessagingServiceSid")).toBe("MG123");
    expect(body.has("From")).toBe(false);
  });

  it("returns Twilio's message id on success", async () => {
    fetchMock.mockResolvedValue(twilioOk("SM999"));
    expect(await sendSms("+34635383712", "hi")).toEqual({ outcome: "sent", id: "SM999" });
  });
});

describe("what a failure means", () => {
  it("treats an invalid number as skipped, not broken", async () => {
    fetchMock.mockResolvedValue(twilioError(400, 21211));
    const r = await sendSms("+34635383712", "hi");
    expect(r.outcome).toBe("skipped");
    expect(r.reason).toMatch(/valid phone number/);
  });

  /** The customer has told the carrier to stop. Respecting that is the point. */
  it("treats a customer who replied STOP as skipped", async () => {
    fetchMock.mockResolvedValue(twilioError(400, 21610));
    const r = await sendSms("+34635383712", "hi");
    expect(r.outcome).toBe("skipped");
    expect(r.reason).toMatch(/STOP|opted out/i);
  });

  it("names the cause when a country is not enabled on the account", async () => {
    fetchMock.mockResolvedValue(twilioError(400, 21408));
    const r = await sendSms("+4915112345678", "hi");
    expect(r.outcome).toBe("skipped");
    expect(r.reason).toMatch(/country/i);
  });

  it("reports a bad login as a real failure, with the code", async () => {
    fetchMock.mockResolvedValue(twilioError(401, 20003, "Authenticate"));
    const r = await sendSms("+34635383712", "hi");
    expect(r.outcome).toBe("failed");
    expect(r.reason).toContain("401");
    expect(r.reason).toContain("20003");
  });

  it("never throws when the network does", async () => {
    fetchMock.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    const r = await sendSms("+34635383712", "hi");
    expect(r.outcome).toBe("failed");
    expect(r.reason).toContain("ENOTFOUND");
  });

  it("survives a response that is not JSON", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("html"); } });
    const r = await sendSms("+34635383712", "hi");
    expect(r.outcome).toBe("failed");
    expect(r.reason).toContain("502");
  });
});

describe("keeping a text cheap", () => {
  it("folds the characters that force the expensive encoding", () => {
    expect(toGsmSafe("Pickup 10:30 — Terminal 1")).toBe("Pickup 10:30 - Terminal 1");
    expect(toGsmSafe("BCN → Sitges")).toBe("BCN to Sitges");
    expect(toGsmSafe("it’s “ready”")).toBe("it's \"ready\"");
    expect(toGsmSafe("te recogerá el vuelo")).toBe("te recogera el vuelo");
    expect(toGsmSafe("Terminal 2 · Gate")).toBe("Terminal 2  Gate");
  });

  it("leaves alone the accents GSM already has", () => {
    // é, ñ and ü are in the alphabet and cost nothing extra.
    expect(toGsmSafe("Barcelona café señor München")).toBe("Barcelona café señor München");
  });

  it("counts a single-byte message as one segment up to 160", () => {
    expect(smsSegments("a".repeat(160))).toBe(1);
    expect(smsSegments("a".repeat(161))).toBe(2);
    expect(smsSegments("a".repeat(306))).toBe(2);
    expect(smsSegments("a".repeat(307))).toBe(3);
    expect(smsSegments("")).toBe(0);
  });

  it("counts the euro sign as two, because it is in the extension table", () => {
    expect(smsSegments("€".repeat(80))).toBe(1);
    expect(smsSegments("€".repeat(81))).toBe(2);
  });

  it("sends the folded text, not the original", async () => {
    fetchMock.mockResolvedValue(twilioOk());
    await sendSms("+34635383712", "Pickup — BCN → Sitges");
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(body.get("Body")).toBe("Pickup - BCN to Sitges");
  });

  it("caps a runaway message instead of billing for an essay", async () => {
    fetchMock.mockResolvedValue(twilioOk());
    await sendSms("+34635383712", "word ".repeat(400));
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(body.get("Body")!.length).toBeLessThanOrEqual(480);
  });

  it("does not send an empty text", async () => {
    const r = await sendSms("+34635383712", "中文");
    expect(r.outcome).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
