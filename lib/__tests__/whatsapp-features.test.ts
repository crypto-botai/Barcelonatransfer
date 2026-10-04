import { describe, it, expect } from "vitest";
import { isPaymentTag, MANUAL_TAGS, manualTagInfo, paymentTag, phoneVariants, relevantBooking, TAG_LABELS, type BookingForTag } from "@/lib/whatsapp-tags";
import { assistantReply, detectIntent, mentionedService, unansweredReply } from "@/lib/whatsapp-assistant";
import { GROUP_LIMITS, planBroadcast, sanitizeGroups } from "@/lib/whatsapp-groups";
import { followUpCandidates, MAX_PER_RUN } from "@/lib/whatsapp-followup";
import { resolveServices } from "@/lib/whatsapp-services";
import { DEFAULT_SERVICES, DEFAULT_SETTINGS, DEFAULT_QUICK_REPLIES, LIMITS, sanitizeSettings } from "@/lib/whatsapp-settings";
import { buildConversations, summarize, type Conversation, type LogRow } from "@/lib/whatsapp-inbox";
import { matchQuickReplies } from "@/lib/whatsapp-ui";

/**
 * Payment tags, favorites, groups, and the answer sent when nobody replies.
 *
 * The things that must never happen: a customer tagged as paid when they are
 * not, a message to a group reaching someone it should not, and an automatic
 * reply sent twice or to someone mid-conversation.
 */

// ─── Payment tags ────────────────────────────────────────────────────────────

const NOW = new Date("2026-10-14T10:00:00Z");
const bk = (over: Partial<BookingForTag> = {}): BookingForTag => ({
  id: "b1", confirmationCode: "EBC-1", status: "CONFIRMED", paymentStatus: "PAID", paymentMethod: "CARD_LINK",
  depositAmount: null, balanceAmount: null, balancePaidAt: null, totalAmount: 100,
  pickupDatetime: "2026-10-20T10:00:00Z", ...over,
});

describe("paymentTag", () => {
  it("pending payment: not paid and not a cash booking", () => {
    for (const status of ["PENDING", "FAILED"]) {
      expect(paymentTag(bk({ paymentStatus: status, status: "PENDING" })), status).toMatchObject({ tag: "pending", label: "Pending payment" });
    }
    expect(paymentTag(bk({ paymentStatus: "PENDING", paymentMethod: "BANK_TRANSFER" })).tag).toBe("pending");
    expect(paymentTag(bk({ paymentStatus: "PENDING", paymentMethod: null })).tag).toBe("pending");
  });

  it("paid in full: paid, with no balance outstanding", () => {
    expect(paymentTag(bk())).toMatchObject({ tag: "paid", label: "Paid in full", detail: "€100 paid" });
  });

  it("30% paid: a deposit with the balance still due, with the percentage worked out", () => {
    const t = paymentTag(bk({ depositAmount: 30, balanceAmount: 70 }));
    expect(t).toMatchObject({ tag: "deposit", label: "30% paid" });
    expect(t.detail).toContain("€30 paid");
    expect(t.detail).toContain("€70 balance");
    expect(paymentTag(bk({ depositAmount: 45, balanceAmount: 105 })).label).toBe("30% paid");
    expect(paymentTag(bk({ depositAmount: 50, balanceAmount: 50 })).label).toBe("50% paid");
  });

  it("a deposit booking whose balance has been paid is paid in full", () => {
    expect(paymentTag(bk({ depositAmount: 30, balanceAmount: 70, balancePaidAt: "2026-10-20T11:00:00Z" })).tag).toBe("paid");
  });

  it("cash to chauffeur: set up to be paid in cash and not yet paid", () => {
    expect(paymentTag(bk({ paymentStatus: "PENDING", paymentMethod: "CASH", totalAmount: 55.5 }))).toMatchObject({ tag: "cash", label: "Cash to chauffeur", detail: "€55.50 to be paid to the chauffeur" });
  });

  it("cancelled and refunded bookings are tagged cancelled whatever was paid", () => {
    for (const status of ["CANCELLED", "REFUNDED"]) expect(paymentTag(bk({ status })).tag, status).toBe("cancelled");
  });

  it("never calls an unpaid booking paid", () => {
    for (const ps of ["PENDING", "FAILED", "REFUNDED"]) expect(paymentTag(bk({ paymentStatus: ps, status: "PENDING" })).tag, ps).not.toBe("paid");
  });

  it("has a label for every tag", () => {
    expect(Object.keys(TAG_LABELS).sort()).toEqual(["cancelled", "cash", "deposit", "paid", "pending"]);
  });
});

describe("relevantBooking", () => {
  it("is the next journey still to happen", () => {
    const list = [bk({ id: "past", pickupDatetime: "2026-10-01T10:00:00Z" }), bk({ id: "later", pickupDatetime: "2026-10-30T10:00:00Z" }), bk({ id: "soon", pickupDatetime: "2026-10-16T10:00:00Z" })];
    expect(relevantBooking(list, NOW)?.id).toBe("soon");
  });
  it("is the most recent when everything is in the past", () => {
    const list = [bk({ id: "old", pickupDatetime: "2026-09-01T10:00:00Z" }), bk({ id: "recent", pickupDatetime: "2026-10-10T10:00:00Z" })];
    expect(relevantBooking(list, NOW)?.id).toBe("recent");
  });
  it("prefers a live booking to a cancelled one, and uses a cancelled one only when nothing else exists", () => {
    const list = [bk({ id: "cancelled", status: "CANCELLED", pickupDatetime: "2026-10-15T10:00:00Z" }), bk({ id: "live", pickupDatetime: "2026-10-25T10:00:00Z" })];
    expect(relevantBooking(list, NOW)?.id).toBe("live");
    expect(relevantBooking([list[0]], NOW)?.id).toBe("cancelled");
  });
  it("is null for no bookings", () => expect(relevantBooking([], NOW)).toBeNull());
  it("writes a number every way a booking may have saved it", () => {
    expect(phoneVariants("+34635383712")).toEqual(["+34635383712", "34635383712", "0034635383712"]);
  });
});

// ─── Favorites and "keep as unread" ──────────────────────────────────────────

const ago = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const P = "+34635383712";
const row = (action: string, at: Date, details: Record<string, unknown> = {}, phone = P): LogRow => ({ action, entityId: phone, createdAt: at, details });
const inMsg = (h: number, text = "hi") => row("WA_MESSAGE", ago(h), { dir: "in", wamid: `i${h}`, text, type: "text" });

describe("favorites and kept-as-unread", () => {
  it("a conversation is not a favorite until starred, and the newest star wins", () => {
    expect(buildConversations([inMsg(5)], NOW)[0].favorite).toBe(false);
    expect(buildConversations([inMsg(5), row("WA_FLAG", ago(4), { kind: "favorite", value: true })], NOW)[0].favorite).toBe(true);
    expect(buildConversations([inMsg(5), row("WA_FLAG", ago(4), { kind: "favorite", value: true }), row("WA_FLAG", ago(3), { kind: "favorite", value: false })], NOW)[0].favorite).toBe(false);
  });

  it("a star on one customer does not touch another", () => {
    const rows = [inMsg(5), { ...inMsg(5), entityId: "+34600000009" }, row("WA_FLAG", ago(4), { kind: "favorite", value: true })];
    const byPhone = Object.fromEntries(buildConversations(rows, NOW).map((c) => [c.phone, c.favorite]));
    expect(byPhone).toEqual({ [P]: true, "+34600000009": false });
  });

  it("keeping a read chat as unread shows it as waiting, until it is opened again", () => {
    const seen = [inMsg(5), row("WA_SEEN", ago(4))];
    expect(buildConversations(seen, NOW)[0]).toMatchObject({ unread: 0, markedUnread: false });
    const kept = [...seen, row("WA_FLAG", ago(3), { kind: "unread", value: true })];
    expect(buildConversations(kept, NOW)[0]).toMatchObject({ unread: 1, markedUnread: true });
    const reopened = [...kept, row("WA_SEEN", ago(2))];
    expect(buildConversations(reopened, NOW)[0]).toMatchObject({ unread: 0, markedUnread: false });
  });

  it("a really new message still counts on top of nothing, and the kept mark never lowers the count", () => {
    const rows = [inMsg(6), inMsg(5), inMsg(4), row("WA_FLAG", ago(3), { kind: "unread", value: true })];
    expect(buildConversations(rows, NOW)[0].unread).toBe(3);
  });

  it("the sidebar count includes a chat kept as unread", () => {
    const rows = [inMsg(5), row("WA_SEEN", ago(4)), row("WA_FLAG", ago(3), { kind: "unread", value: true })];
    expect(summarize(buildConversations(rows, NOW))).toMatchObject({ unread: 1, chats: 1 });
  });
});

// ─── The assistant ───────────────────────────────────────────────────────────

const PRICES: Record<string, number> = { barcelona_city: 50, tossa: 155, girona_city: 165, lloret: 145, sitges: 80, hourly: 45 };
const services = () => resolveServices(DEFAULT_SERVICES, async (z) => PRICES[z] ?? null);

describe("tags chosen by the office", () => {
  const tagFlag = (mins: number, value: unknown) => row("WA_FLAG", ago(mins), { kind: "tag", value });

  it("a chat has no tag of its own until one is chosen, and the newest choice wins", () => {
    expect(buildConversations([inMsg(5)], NOW)[0]).toMatchObject({ manualTag: null, tag: null });
    expect(buildConversations([inMsg(5), tagFlag(4, "pending")], NOW)[0]).toMatchObject({ manualTag: "pending", tag: { tag: "pending", label: "Pending payment", source: "manual" } });
    expect(buildConversations([inMsg(5), tagFlag(4, "pending"), tagFlag(3, "cash")], NOW)[0].manualTag).toBe("cash");
  });

  it("choosing Automatic (null) hands the tag back", () => {
    expect(buildConversations([inMsg(5), tagFlag(4, "paid"), tagFlag(3, null)], NOW)[0]).toMatchObject({ manualTag: null, tag: null });
  });

  it("ignores a stored value that is not a payment tag", () => {
    expect(buildConversations([inMsg(5), tagFlag(4, "vip")], NOW)[0].manualTag).toBeNull();
  });

  it("a tag on one customer does not touch another, and does not disturb the star", () => {
    const rows = [inMsg(5), { ...inMsg(5), entityId: "+34600000009" }, tagFlag(4, "deposit"), row("WA_FLAG", ago(3), { kind: "favorite", value: true })];
    const [a, b] = buildConversations(rows, NOW).sort((x, y) => x.phone.localeCompare(y.phone));
    expect([a.phone, a.manualTag === null]).toEqual(["+34600000009", true]);
    expect(b).toMatchObject({ manualTag: "deposit", favorite: true });
  });

  it("offers the four the office asked for, and names 30% as 30%", () => {
    expect(MANUAL_TAGS).toEqual(["pending", "deposit", "cash", "paid"]);
    expect(MANUAL_TAGS.map((t) => manualTagInfo(t).label)).toEqual(["Pending payment", "30% paid", "Cash to chauffeur", "Paid in full"]);
    expect(isPaymentTag("cash")).toBe(true);
    expect(isPaymentTag("auto")).toBe(false);
    expect(isPaymentTag(null)).toBe(false);
  });
});

describe("detectIntent", () => {
  it.each([
    ["How much to Sitges?", "price"],
    ["what is the price from the airport", "price"],
    ["Cuánto cuesta ir a Girona", "price"],
    ["Combien pour Tossa", "price"],
    ["I want to book a transfer", "book"],
    ["Quiero reservar un taxi", "book"],
    ["can I pay cash to the driver?", "payment"],
    ["Do you take cards", "payment"],
    ["can I pay a 30% deposit", "payment"],
    ["is the deposit refundable", "cancel"],
    ["my flight is delayed", "flight"],
    ["Mi vuelo llega tarde", "flight"],
    ["I need to cancel", "cancel"],
    ["can I get a refund", "cancel"],
    ["where do we meet the driver", "meeting"],
    ["thanks!", "thanks"],
    ["Hello", "greeting"],
    ["Hola buenas tardes", "greeting"],
  ])("%s -> %s", (text, intent) => expect(detectIntent(text)).toBe(intent));

  it("treats cancel and price as stronger than book", () => {
    expect(detectIntent("how much to book Sitges")).toBe("price");
    expect(detectIntent("I want to cancel my booking")).toBe("cancel");
  });

  it("does not guess at things it does not know", () => {
    for (const t of ["", "   ", "my daughter is 7 and loves dogs", "can you recommend a restaurant in Gracia", "123456", "ok"]) expect(detectIntent(t), t).toBeNull();
  });

  it("does not take a long message that merely starts with hello for a greeting", () => {
    expect(detectIntent("hello I have a long question about something else entirely today")).toBeNull();
  });
});

describe("assistantReply", () => {
  it("quotes the live price for the place named, with the booking link", async () => {
    const r = assistantReply("How much to Tossa de Mar?", await services())!;
    expect(r).toContain("from €155");
    expect(r).toContain("https://www.elitebcn.info/transfers/tossa-de-mar");
    expect(r).toContain("no surge");
  });

  it("follows the price table: a changed price changes the answer", async () => {
    const changed = await resolveServices(DEFAULT_SERVICES, async (z) => (z === "tossa" ? 170 : PRICES[z] ?? null));
    expect(assistantReply("price for tossa", changed)).toContain("from €170");
  });

  it("answers hourly hire per hour, and airport directions the right way round", async () => {
    const sv = await services();
    expect(assistantReply("how much per hour with a driver", sv)).toContain("from €45 per hour");
    expect(assistantReply("price from the airport", sv)).toContain("Airport to City");
    expect(assistantReply("price to the airport", sv)).toContain("City to Airport");
  });

  it("gives a general answer, never a made-up price, for a place it has no price for", async () => {
    const r = assistantReply("how much to Madrid", await services())!;
    expect(r).not.toMatch(/€\d/);
    expect(r).toContain("https://www.elitebcn.info/book");
  });

  it("does not quote a service the office has switched off", async () => {
    const off = await resolveServices(DEFAULT_SERVICES.map((s) => (s.id === "sitges" ? { ...s, enabled: false } : s)), async (z) => PRICES[z] ?? null);
    expect(assistantReply("how much to Sitges", off)).not.toMatch(/€80/);
  });

  it("states the payment terms the site really has, and nothing more", async () => {
    const r = assistantReply("can I pay the driver in cash", await services())!;
    expect(r).toContain("30%");
    expect(r).toContain("cash or by card");
  });

  it("sends cancellations to the written terms and promises no refund", async () => {
    const r = assistantReply("I want to cancel", await services())!;
    expect(r).toContain("https://www.elitebcn.info/refund-policy");
    expect(r).not.toMatch(/full refund|free|guarantee/i);
  });

  it("every answer except thanks says a person will follow up", async () => {
    const sv = await services();
    for (const q of ["hello", "how much to sitges", "i want to book", "can i pay cash", "my flight is late", "cancel", "where do we meet"]) {
      expect(assistantReply(q, sv), q).toContain("A member of our team will also reply");
    }
  });

  it("never promises a paid extra as included, or anything it cannot keep", async () => {
    const sv = await services();
    for (const q of ["hello", "how much to sitges", "i want to book", "can i pay cash", "my flight is late", "cancel", "where do we meet", "thanks"]) {
      expect(assistantReply(q, sv), q).not.toMatch(/meet & greet|free of charge|guaranteed|included/i);
    }
  });

  it("is short enough to read on a phone", async () => {
    const sv = await services();
    for (const q of ["hello", "how much to sitges", "i want to book", "can i pay cash", "my flight is late", "cancel", "where do we meet"]) {
      expect(assistantReply(q, sv)!.length, q).toBeLessThan(400);
    }
  });
});

describe("mentionedService", () => {
  it("finds a service by the place named, in any case, with or without accents", async () => {
    const sv = await services();
    expect(mentionedService("LLORET please", sv)?.id).toBe("lloret-de-mar");
    expect(mentionedService("a Gerona", sv)?.id).toBe("girona");
    expect(mentionedService("to nowhere", sv)).toBeNull();
  });
});

describe("unansweredReply", () => {
  const HOLD = "We will reply shortly.";
  it("uses the assistant's answer when it has one", async () => {
    const r = unansweredReply({ text: "how much to sitges", type: "text", assistant: true, holding: HOLD, services: await services() });
    expect(r.kind).toBe("assistant");
    expect(r.text).toContain("€80");
  });
  it("uses the holding message when the assistant is off or does not know", async () => {
    const sv = await services();
    expect(unansweredReply({ text: "how much to sitges", type: "text", assistant: false, holding: HOLD, services: sv })).toEqual({ text: HOLD, kind: "holding" });
    expect(unansweredReply({ text: "tell me a joke", type: "text", assistant: true, holding: HOLD, services: sv })).toEqual({ text: HOLD, kind: "holding" });
  });
  it("does not try to read a photo or a voice note", async () => {
    const sv = await services();
    for (const type of ["image", "audio", "document", "location", "sticker"]) {
      expect(unansweredReply({ text: "[image] how much to sitges", type, assistant: true, holding: HOLD, services: sv }).kind, type).toBe("holding");
    }
  });
});

// ─── Groups ──────────────────────────────────────────────────────────────────

describe("sanitizeGroups", () => {
  it("keeps names and valid numbers only, and drops duplicates", () => {
    const g = sanitizeGroups([{ name: "  Friday   arrivals ", members: ["+34 612 345 678", "0034612345678", "612345678", "garbage", "+44 7455 731577"] }]);
    expect(g).toHaveLength(1);
    expect(g[0].name).toBe("Friday arrivals");
    expect(g[0].members).toEqual(["+34612345678", "+447455731577"]);
  });
  it("drops a group with no name, and gives duplicate names their own ids", () => {
    const g = sanitizeGroups([{ name: "" }, { name: "VIP" }, { name: "VIP" }, { name: "VIP" }]);
    expect(g.map((x) => x.name)).toEqual(["VIP", "VIP", "VIP"]);
    expect(new Set(g.map((x) => x.id)).size).toBe(3);
  });
  it("limits how many groups, members and characters", () => {
    expect(sanitizeGroups(Array.from({ length: 40 }, (_, i) => ({ name: `G${i}` })))).toHaveLength(GROUP_LIMITS.groups);
    const many = Array.from({ length: 300 }, (_, i) => `+3461234${String(i).padStart(4, "0")}`);
    expect(sanitizeGroups([{ name: "Big", members: many }])[0].members).toHaveLength(GROUP_LIMITS.members);
    expect(sanitizeGroups([{ name: "x".repeat(200) }])[0].name).toHaveLength(GROUP_LIMITS.name);
  });
  it("copes with anything", () => {
    for (const v of [null, undefined, "x", 5, {}, [null, 3, "x"]]) expect(sanitizeGroups(v)).toEqual([]);
  });
});

describe("planBroadcast: who a message reaches", () => {
  const group = { id: "g", name: "G", members: ["+34600000001", "+34600000002", "+34600000003"] };
  it("reaches only members whose 24-hour window is open", () => {
    const plan = planBroadcast(group, [{ phone: "+34600000001", windowOpen: true }, { phone: "+34600000002", windowOpen: false }]);
    expect(plan.eligible).toEqual(["+34600000001"]);
    expect(plan.skipped).toEqual([
      { phone: "+34600000002", reason: "last wrote more than 24 hours ago" },
      { phone: "+34600000003", reason: "has not written to us" },
    ]);
  });
  it("reaches nobody who is not a member, and an empty group reaches nobody", () => {
    expect(planBroadcast(group, [{ phone: "+34699999999", windowOpen: true }]).eligible).toEqual([]);
    expect(planBroadcast({ ...group, members: [] }, [{ phone: "+34600000001", windowOpen: true }]).eligible).toEqual([]);
  });
});

// ─── The follow-up when nobody replies ───────────────────────────────────────

const conv = (over: Partial<Conversation> = {}): Conversation => ({
  phone: P, name: null, lastText: "hello", lastType: "text", lastAt: new Date(NOW.getTime() - 20 * 60_000).toISOString(), lastDir: "in",
  lastStatus: null, unread: 1, favorite: false, markedUnread: false, booking: null, manualTag: null, tag: null, lastInText: "hello", lastInAt: new Date(NOW.getTime() - 20 * 60_000).toISOString(),
  windowEndsAt: new Date(NOW.getTime() + 23 * 3600_000).toISOString(), windowOpen: true, ...over,
});

describe("followUpCandidates", () => {
  it("picks a customer who has waited longer than the chosen time", () => {
    expect(followUpCandidates([conv()], NOW, 10)).toHaveLength(1);
  });
  it("leaves one who has not waited long enough", () => {
    expect(followUpCandidates([conv()], NOW, 30)).toHaveLength(0);
  });
  it("leaves a conversation where the office spoke last", () => {
    expect(followUpCandidates([conv({ lastDir: "out" })], NOW, 10)).toHaveLength(0);
  });
  it("leaves a customer whose window is closed or about to close", () => {
    expect(followUpCandidates([conv({ windowOpen: false })], NOW, 10)).toHaveLength(0);
    expect(followUpCandidates([conv({ windowEndsAt: new Date(NOW.getTime() + 2 * 60_000).toISOString() })], NOW, 10)).toHaveLength(0);
    expect(followUpCandidates([conv({ windowEndsAt: null })], NOW, 10)).toHaveLength(0);
  });
  it("is capped per run", () => expect(MAX_PER_RUN).toBeLessThanOrEqual(20));
});

// ─── Settings added for this ─────────────────────────────────────────────────

describe("settings for the new features", () => {
  it("automatic messages: only the cash switch is off by default", () => {
    expect(DEFAULT_SETTINGS.autoMessages).toEqual({
      cashBookings: false, headsUp: true, flightAlerts: true, driverFlightAlerts: true,
      driverJobAlerts: true, completionNote: true, cancellationNotice: true, officeAlerts: true,
    });
    expect(sanitizeSettings({}).autoMessages).toEqual(DEFAULT_SETTINGS.autoMessages);
    expect(sanitizeSettings({ autoMessages: { cashBookings: "yes" } }).autoMessages.cashBookings).toBe(false);
    expect(sanitizeSettings({ autoMessages: { headsUp: false } }).autoMessages.headsUp).toBe(false);
    expect(sanitizeSettings({ autoMessages: { officeAlerts: false, cancellationNotice: false } }).autoMessages).toMatchObject({ officeAlerts: false, cancellationNotice: false, completionNote: true });
  });

  it("the nobody-replies answer is off until switched on, and its wait is kept sensible", () => {
    expect(DEFAULT_SETTINGS.unanswered.enabled).toBe(false);
    const u = (minutes: unknown) => sanitizeSettings({ unanswered: { enabled: true, minutes } }).unanswered.minutes;
    expect(u(10)).toBe(10);
    expect(u(0)).toBe(LIMITS.minMinutes);
    expect(u(-5)).toBe(LIMITS.minMinutes);
    expect(u(99999)).toBe(LIMITS.maxMinutes);
    expect(u("abc")).toBe(DEFAULT_SETTINGS.unanswered.minutes);
    expect(u(7.6)).toBe(8);
  });

  it("an empty holding message falls back to the default rather than sending nothing", () => {
    expect(sanitizeSettings({ unanswered: { enabled: true, text: "   " } }).unanswered.text).toBe(DEFAULT_SETTINGS.unanswered.text);
  });
});

describe("the ready-made saved replies", () => {
  it("covers the usual situations, each with a short unique shortcut", () => {
    const keys = DEFAULT_QUICK_REPLIES.map((r) => r.shortcut);
    expect(new Set(keys).size).toBe(keys.length);
    for (const want of ["price", "payment", "cash", "link", "flight", "driver", "delay", "child", "invoice", "change", "cancel", "lost", "review", "thanks"]) expect(keys).toContain(want);
    for (const r of DEFAULT_QUICK_REPLIES) {
      expect(r.shortcut).toMatch(/^[a-z0-9-]{1,20}$/);
      expect(r.text.length).toBeGreaterThan(20);
      expect(r.text.length).toBeLessThanOrEqual(LIMITS.replyText);
    }
  });

  it("survive being cleaned unchanged", () => {
    expect(sanitizeSettings({ quickReplies: DEFAULT_QUICK_REPLIES }).quickReplies).toEqual(DEFAULT_QUICK_REPLIES);
  });

  it("promise no paid extra as included and no refund terms the site does not state", () => {
    for (const r of DEFAULT_QUICK_REPLIES) {
      expect(r.text, r.shortcut).not.toMatch(/free of charge|included in the price|full refund|guarantee/i);
    }
    // The one reply that mentions meet & greet says it is an extra.
    expect(DEFAULT_QUICK_REPLIES.find((r) => /meet & greet/.test(r.text))?.text).toMatch(/extra/);
  });

  it("states the payment terms the checkout really offers", () => {
    expect(DEFAULT_QUICK_REPLIES.find((r) => r.shortcut === "payment")!.text).toContain("30%");
  });

  it("the slash picker finds them by shortcut", () => {
    expect(matchQuickReplies("/ca", DEFAULT_QUICK_REPLIES)!.map((r) => r.shortcut)).toEqual(expect.arrayContaining(["cash", "cancel"]));
    expect(matchQuickReplies("/inv", DEFAULT_QUICK_REPLIES)!.map((r) => r.shortcut)).toEqual(["invoice"]);
  });
});
