import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { BASE_URL } from "@/lib/seo";
import { twilioSignature } from "@/lib/twilio-webhook";
import { spokenToEmail, splitBooking, wantsHuman, wantsSpanish, forSpeech } from "@/lib/voice-agent";

/** The phone booking agent. The model, the database, texts and the booking engine are mocked: no call, text or booking is made. */

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), create: vi.fn(), reply: vi.fn(), budget: vi.fn(), book: vi.fn(), sms: vi.fn(), notify: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { activityLog: { findMany: mocks.findMany, create: mocks.create } } }));
vi.mock("@/lib/ai/agents/support", () => ({ getSupportReply: mocks.reply }));
vi.mock("@/lib/ai/budget", () => ({ isBudgetAvailable: mocks.budget }));
vi.mock("@/lib/ai/bookingFromChat", () => ({ createBookingFromChat: mocks.book }));
vi.mock("@/lib/sms", () => ({ sendSms: mocks.sms }));
vi.mock("@/lib/whatsapp", () => ({ notifyAdmin: mocks.notify }));

import { POST as inbound } from "@/app/api/twilio/voice/route";
import { POST as turn } from "@/app/api/twilio/voice/turn/route";

const TOKEN = "test-token";
const FROM = "+34600111222";

function call(path: string, params: Record<string, string>, sign = true) {
  const url = `${BASE_URL}${path}`;
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(sign ? { "x-twilio-signature": twilioSignature(url, params, TOKEN) } : {}) },
    body: new URLSearchParams(params).toString(),
  });
}
const text = (r: Response) => r.text();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_AUTH_TOKEN", TOKEN);
  vi.stubEnv("VOICE_AGENT_ENABLED", "true");
  mocks.findMany.mockResolvedValue([]);
  mocks.create.mockResolvedValue({});
  mocks.budget.mockResolvedValue(true);
  mocks.sms.mockResolvedValue({ outcome: "sent" });
  mocks.notify.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("helpers", () => {
  it("turns a spoken email into an address", () => {
    expect(spokenToEmail("john dot smith at gmail dot com")).toBe("john.smith@gmail.com");
    expect(spokenToEmail("ana@gmail.com")).toBe("ana@gmail.com");
  });
  it("splits a booking block from the words to say", () => {
    const r = splitBooking('Thanks. <BOOKING_JSON>{"name":"A","phone":"1","email":"a@b.co","pickup":"x","dropoff":"y","date":"2026-11-05","time":"10:00","passengers":2,"luggage":1}</BOOKING_JSON>');
    expect(r.speech).toBe("Thanks.");
    expect(r.draft?.name).toBe("A");
    expect(splitBooking("<BOOKING_JSON>{oops</BOOKING_JSON>").malformed).toBe(true);
    expect(splitBooking("Just talking").draft).toBeNull();
  });
  it("recognises a request for a person or for Spanish, and strips what a voice would spell out", () => {
    expect(wantsHuman("can I speak to a real person")).toBe(true);
    expect(wantsHuman("I need a taxi tomorrow")).toBe(false);
    expect(wantsSpanish("español por favor")).toBe(true);
    expect(forSpeech("See **this** [link](https://x.com) now")).toBe("See this link now");
  });
});

describe("the incoming call", () => {
  it("refuses a request Twilio did not sign", async () => {
    expect((await inbound(call("/api/twilio/voice", { CallSid: "CA1" }, false))).status).toBe(403);
  });
  it("puts the caller through to the office while the agent is off", async () => {
    vi.stubEnv("VOICE_AGENT_ENABLED", "");
    const xml = await text(await inbound(call("/api/twilio/voice", { CallSid: "CA1", From: FROM })));
    expect(xml).toContain("<Dial>+34635383712</Dial>");
    expect(xml).not.toContain("<Gather");
  });
  it("greets, says it is automated and listens when the agent is on", async () => {
    const xml = await text(await inbound(call("/api/twilio/voice", { CallSid: "CA1", From: FROM })));
    expect(xml).toContain("<Gather");
    expect(xml).toContain("automated booking assistant");
  });
});

describe("a turn", () => {
  const path = "/api/twilio/voice/turn?lang=en&n=0";

  it("refuses an unsigned request and never reaches the model", async () => {
    expect((await turn(call(path, { CallSid: "CA1", SpeechResult: "hi" }, false))).status).toBe(403);
    expect(mocks.reply).not.toHaveBeenCalled();
  });
  it("hands over to the office when the caller asks for a person", async () => {
    const xml = await text(await turn(call(path, { CallSid: "CA1", From: FROM, SpeechResult: "let me talk to a person" })));
    expect(xml).toContain("<Dial>+34635383712</Dial>");
    expect(mocks.reply).not.toHaveBeenCalled();
  });
  it("asks again on silence and gives up to a person after two", async () => {
    expect(await text(await turn(call("/api/twilio/voice/turn?lang=en&n=0", { CallSid: "CA1", From: FROM })))).toContain("<Gather");
    expect(await text(await turn(call("/api/twilio/voice/turn?lang=en&n=2", { CallSid: "CA1", From: FROM })))).toContain("<Dial>");
  });
  it("goes to the office when the AI budget is spent", async () => {
    mocks.budget.mockResolvedValue(false);
    expect(await text(await turn(call(path, { CallSid: "CA1", From: FROM, SpeechResult: "hello" })))).toContain("<Dial>");
  });
  it("speaks the reply and keeps listening", async () => {
    mocks.reply.mockResolvedValue({ reply: "Where would you like to be picked up?", escalate: false });
    const xml = await text(await turn(call(path, { CallSid: "CA1", From: FROM, SpeechResult: "I need a transfer" })));
    expect(xml).toContain("Where would you like to be picked up?");
    expect(xml).toContain("<Gather");
    expect(mocks.reply).toHaveBeenCalledWith("CA1", [{ role: "user", content: "I need a transfer" }], "en", { callerNumber: FROM });
  });
  it("books, texts the payment link, reads the price and the reference, and hangs up after", async () => {
    mocks.reply.mockResolvedValue({
      reply: 'Thank you. <BOOKING_JSON>{"name":"Ana Ruiz","phone":"","email":"ana at gmail dot com","pickup":"BCN Airport T1","dropoff":"Hotel Arts Barcelona","date":"2026-11-05","time":"10:00","passengers":2,"luggage":2,"flightNumber":"VY1234"}</BOOKING_JSON>',
      escalate: false,
    });
    mocks.book.mockResolvedValue({ success: true, bookingId: "b1", reference: "EBC-AB12", amount: 55, paymentUrl: "/booking/b1" });
    const xml = await text(await turn(call(path, { CallSid: "CA1", From: FROM, SpeechResult: "yes book it" })));
    const draft = mocks.book.mock.calls[0][0];
    expect(draft.phone).toBe(FROM);
    expect(draft.email).toBe("ana@gmail.com");
    expect(mocks.sms).toHaveBeenCalledWith(FROM, expect.stringContaining("https://www.elitebcn.info/booking/b1"), { bookingId: "b1" });
    expect(xml).toContain("55 euros");
    expect(xml).toContain("EBC-AB12".replace("-", ""));
    expect(xml).toContain("<Hangup/>");
  });
  it("tells the office and the caller when the booking cannot be made", async () => {
    mocks.reply.mockResolvedValue({ reply: '<BOOKING_JSON>{"name":"A","phone":"","email":"bad","pickup":"x","dropoff":"y","date":"2026-11-05","time":"10:00","passengers":1,"luggage":0}</BOOKING_JSON>', escalate: false });
    mocks.book.mockResolvedValue({ success: false, error: "Invalid email" });
    const xml = await text(await turn(call(path, { CallSid: "CA1", From: FROM, SpeechResult: "yes" })));
    expect(xml).toContain("call you back");
    expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining("Invalid email"));
    expect(mocks.sms).not.toHaveBeenCalled();
  });
});
