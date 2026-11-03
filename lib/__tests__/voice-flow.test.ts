import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { BASE_URL } from "@/lib/seo";
import { twilioSignature } from "@/lib/twilio-webhook";
import {
  applyWhen, cleanPlace, confirmText, initialState, parseChange, parseCount, parseEmail, parseFlight, parseName, parseYesNo, step,
  type FlowState,
} from "@/lib/voice-flow";

/** The guided phone booking. The reading of answers is plain code, so it is tested directly; the route is tested with its edges mocked. */

describe("reading answers", () => {
  it("counts from words, digits and keys", () => {
    expect(parseCount("two")).toBe(2);
    expect(parseCount("we are 4 people")).toBe(4);
    expect(parseCount("just me")).toBe(1);
    expect(parseCount("none")).toBe(0);
    expect(parseCount("", "3")).toBe(3);
    expect(parseCount("blah")).toBeNull();
    expect(parseCount("dos")).toBe(2);
  });
  it("hears yes and no, by voice or key", () => {
    expect(parseYesNo("yes please")).toBe(true);
    expect(parseYesNo("no that is wrong")).toBe(false);
    expect(parseYesNo("", "1")).toBe(true);
    expect(parseYesNo("", "2")).toBe(false);
    expect(parseYesNo("hmm")).toBeNull();
    expect(parseYesNo("sí")).toBe(true);
  });
  it("keeps a place intact and drops only the lead-in", () => {
    expect(cleanPlace("Hotel Arts in Barcelona")).toBe("Hotel Arts in Barcelona");
    expect(cleanPlace("from the airport")).toBe("the airport");
    expect(cleanPlace("I would like to be picked up from Hotel Arts")).toBe("Hotel Arts");
  });
  it("reads flight numbers, names and emails as people say them", () => {
    expect(parseFlight("v y one two three four")).toBe("VY1234");
    expect(parseFlight("BA 478")).toBe("BA478");
    expect(parseFlight("no flight")).toBe("skip");
    expect(parseName("my name is ana ruiz")).toBe("Ana Ruiz");
    expect(parseEmail("john dot smith at gmail dot com")).toBe("john.smith@gmail.com");
    expect(parseEmail("not an email")).toBeNull();
  });
  it("finds which part the caller wants changed", () => {
    expect(parseChange("the pickup")).toBe("pickup");
    expect(parseChange("the time")).toBe("when");
    expect(parseChange("passengers")).toBe("pax");
    expect(parseChange("everything")).toBeNull();
  });
});

describe("the question flow", () => {
  it("asks the questions in order and skips the flight for a city journey", () => {
    let r = step(initialState(), "Hotel Arts Barcelona");
    expect(r.state.step).toBe("dropoff");
    r = step(r.state, "Sagrada Familia");
    expect(r.state.step).toBe("when");
    expect(step(r.state, "tomorrow at ten").needWhen).toBe("tomorrow at ten");
  });
  it("asks for the flight when an airport is involved", () => {
    let r = step(initialState(), "the airport");
    r = step(r.state, "Hotel Arts");
    expect(r.state.step).toBe("flight");
    r = step(r.state, "V Y 1234");
    expect(r.state.step).toBe("when");
    expect(r.state.slots.flight).toBe("VY1234");
  });
  it("walks from the day and time to a confirmation and then a booking", () => {
    let r = step(initialState(), "Hotel Arts");
    r = step(r.state, "Sagrada Familia");
    r = applyWhen(r.state, "2099-11-05", "10:30");
    expect(r.state.step).toBe("pax");
    r = step(r.state, "two");
    expect(r.state.step).toBe("bags");
    r = step(r.state, "", "3");
    expect(r.state.slots.luggage).toBe(3);
    r = step(r.state, "Ana Ruiz");
    expect(r.state.step).toBe("email");
    r = step(r.state, "ana at gmail dot com");
    expect(r.state.step).toBe("email_ok");
    expect(r.say).toContain("ana at gmail dot com");
    r = step(r.state, "", "1");
    expect(r.state.step).toBe("confirm");
    expect(r.say).toContain("Hotel Arts");
    expect(r.say).toContain("Sagrada Familia");
    expect(r.say).toContain("2 passengers");
    expect(step(r.state, "yes").book).toBe(true);
  });
  it("a wrong email read-back asks for it again", () => {
    const st: FlowState = { ...initialState(), step: "email_ok", slots: { email: "ana@gmail.com" } };
    expect(step(st, "", "2").state.step).toBe("email");
  });
  it("changing one answer comes straight back to the confirmation", () => {
    const slots = { pickup: "A", dropoff: "B", date: "2099-11-05", time: "10:00", passengers: 2, luggage: 1, name: "Ana", email: "a@b.co" };
    let r = step({ ...initialState(), step: "confirm", slots }, "no");
    expect(r.state.step).toBe("change");
    r = step(r.state, "the passengers");
    expect(r.state.step).toBe("pax");
    r = step(r.state, "four");
    expect(r.state.step).toBe("confirm");
    expect(r.state.slots.passengers).toBe(4);
    expect(r.say).toContain("4 passengers");
  });
  it("a time in the past is refused, and an unreadable one asks again then hands over", () => {
    const st: FlowState = { ...initialState(), step: "when" };
    expect(applyWhen(st, "2020-01-01", "10:00").say).toContain("already passed");
    const first = applyWhen(st, null, null);
    expect(first.handoff).toBeUndefined();
    const second = applyWhen(first.state, null, null);
    expect(second.handoff).toBeUndefined();
    expect(applyWhen(second.state, null, null).handoff).toBe(true);
  });
  it("two failed answers in a row put the caller through to a person", () => {
    const st: FlowState = { ...initialState(), step: "pax" };
    const a = step(st, "banana");
    expect(a.handoff).toBeUndefined();
    expect(a.say).toContain("number");
    const b = step(a.state, "apple");
    expect(b.handoff).toBeUndefined();
    expect(step(b.state, "pear").handoff).toBe(true);
  });
  it("the confirmation says what will be booked", () => {
    expect(confirmText({ pickup: "A", dropoff: "B", date: "2099-11-05", time: "10:00", passengers: 2, name: "Ana" }, "en")).toContain("Press 1");
  });
});

// ─── The route ────────────────────────────────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(), create: vi.fn(), budget: vi.fn(), when: vi.fn(), book: vi.fn(), notify: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { activityLog: { findFirst: mocks.findFirst, create: mocks.create, findMany: vi.fn().mockResolvedValue([]) } } }));
vi.mock("@/lib/ai/budget", () => ({ isBudgetAvailable: mocks.budget }));
vi.mock("@/lib/voice-when", () => ({ readWhen: mocks.when }));
vi.mock("@/lib/voice-booking", () => ({ bookByPhone: mocks.book }));
vi.mock("@/lib/whatsapp", () => ({ notifyAdmin: mocks.notify }));

import { POST as guided } from "@/app/api/twilio/voice/guided/route";

const TOKEN = "test-token";
const FROM = "+34600111222";
const call = (params: Record<string, string>, sign = true) => {
  const url = `${BASE_URL}/api/twilio/voice/guided`;
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(sign ? { "x-twilio-signature": twilioSignature(url, params, TOKEN) } : {}) },
    body: new URLSearchParams(params).toString(),
  });
};

describe("the guided call route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TWILIO_AUTH_TOKEN", TOKEN);
    vi.stubEnv("VOICE_AGENT_ENABLED", "true");
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({});
    mocks.budget.mockResolvedValue(true);
    mocks.notify.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuses an unsigned request", async () => {
    expect((await guided(call({ CallSid: "CA1" }, false))).status).toBe(403);
  });
  it("takes the first answer and asks for the destination, listening again on silence", async () => {
    const xml = await (await guided(call({ CallSid: "CA1", From: FROM, SpeechResult: "Hotel Arts Barcelona" }))).text();
    expect(xml).toContain("And where are you going?");
    expect(xml).toContain("<Redirect");
  });
  it("saves where the call has got to", async () => {
    await guided(call({ CallSid: "CA1", From: FROM, SpeechResult: "Hotel Arts Barcelona" }));
    const saved = mocks.create.mock.calls.map((c) => c[0].data).find((d) => d.action === "VOICE_STATE");
    expect(saved.details.state.step).toBe("dropoff");
    expect(saved.details.state.slots.pickup).toBe("Hotel Arts Barcelona");
  });
  it("reads the day and time with the model and moves on to passengers", async () => {
    mocks.findFirst.mockResolvedValue({ details: { state: { lang: "en", step: "when", slots: { pickup: "A", dropoff: "B" }, fails: 0 } } });
    mocks.when.mockResolvedValue({ date: "2099-11-05", time: "10:30" });
    const xml = await (await guided(call({ CallSid: "CA1", From: FROM, SpeechResult: "the fifth of november at half past ten" }))).text();
    expect(xml).toContain("How many passengers");
  });
  it("creates the booking only after the caller confirms", async () => {
    const slots = { pickup: "A", dropoff: "B", date: "2099-11-05", time: "10:30", passengers: 2, luggage: 1, name: "Ana", email: "a@b.co", flight: null };
    mocks.findFirst.mockResolvedValue({ details: { state: { lang: "en", step: "confirm", slots, fails: 0 } } });
    mocks.book.mockResolvedValue(new Response("<Response/>"));
    await guided(call({ CallSid: "CA1", From: FROM, Digits: "1" }));
    expect(mocks.book).toHaveBeenCalledTimes(1);
    expect(mocks.book.mock.calls[0][0]).toMatchObject({ name: "Ana", phone: FROM, pickup: "A", dropoff: "B", passengers: 2, email: "a@b.co" });
    expect(mocks.book.mock.calls[0][1]).toMatchObject({ callSid: "CA1", lang: "en" });
  });
  it("puts the caller through to the office when they ask for an agent, or when the model is unavailable for the date", async () => {
    expect(await (await guided(call({ CallSid: "CA1", From: FROM, SpeechResult: "I want an agent" }))).text()).toContain("<Dial timeout=\"25\">+34635383712</Dial>");
    mocks.findFirst.mockResolvedValue({ details: { state: { lang: "en", step: "when", slots: {}, fails: 0 } } });
    mocks.budget.mockResolvedValue(false);
    expect(await (await guided(call({ CallSid: "CA1", From: FROM, SpeechResult: "tomorrow at ten" }))).text()).toContain("<Dial");
    expect(mocks.notify).toHaveBeenCalled();
  });
  it("switches to Spanish on the first question", async () => {
    const xml = await (await guided(call({ CallSid: "CA1", From: FROM, SpeechResult: "español por favor" }))).text();
    expect(xml).toContain("hablamos en español");
  });
});
