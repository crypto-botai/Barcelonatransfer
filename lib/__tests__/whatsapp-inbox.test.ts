import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  parseWebhook, validMetaSignature, buildConversations, buildThread, canReplyFreely, summarize,
  latestInboundId, windowEndsAt, waPhone, SESSION_WINDOW_MS, type LogRow,
} from "@/lib/whatsapp-inbox";

/**
 * The WhatsApp inbox.
 *
 * The webhook is public, so the first thing proved is that a request Meta did
 * not sign stores nothing. After that: payloads are read tolerantly, a
 * conversation is built correctly from log rows, and a free-text reply is only
 * allowed inside the 24 hours Meta permits. Network and database are mocked.
 */

const SECRET = "app-secret";
const sign = (body: string, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

const inboundPayload = (over: Record<string, unknown> = {}) => ({
  object: "whatsapp_business_account",
  entry: [{
    changes: [{
      value: {
        contacts: [{ wa_id: "34635383712", profile: { name: "Ana" } }],
        messages: [{ from: "34635383712", id: "wamid.IN1", timestamp: "1790000000", type: "text", text: { body: "Hello" }, ...over }],
      },
    }],
  }],
});

describe("parseWebhook", () => {
  it("reads a text message with the sender's name and an E.164 number", () => {
    const { messages } = parseWebhook(inboundPayload());
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ wamid: "wamid.IN1", phone: "+34635383712", name: "Ana", type: "text", text: "Hello", mediaId: null });
    expect(messages[0].at.getTime()).toBe(1790000000 * 1000);
  });

  it("labels media, keeps the caption and the media id", () => {
    const { messages } = parseWebhook(inboundPayload({ type: "image", text: undefined, image: { id: "MEDIA1", caption: "my flight" } }));
    expect(messages[0]).toMatchObject({ text: "[image] my flight", mediaId: "MEDIA1" });
  });

  it("turns a shared location into a map link", () => {
    const { messages } = parseWebhook(inboundPayload({ type: "location", text: undefined, location: { latitude: 41.3, longitude: 2.1, name: "Hotel" } }));
    expect(messages[0].text).toContain("https://www.google.com/maps?q=41.3,2.1");
  });

  it("reads delivery statuses and the failure reason", () => {
    const { statuses } = parseWebhook({
      entry: [{ changes: [{ value: { statuses: [
        { id: "wamid.OUT1", status: "delivered", timestamp: "1790000100", recipient_id: "34635383712" },
        { id: "wamid.OUT2", status: "failed", timestamp: "1790000200", recipient_id: "34635383712", errors: [{ code: 131047, title: "Re-engagement message" }] },
        { id: "wamid.OUT3", status: "deleted", timestamp: "1", recipient_id: "34635383712" },
      ] } }] }],
    });
    expect(statuses.map((s) => s.status)).toEqual(["delivered", "failed"]);
    expect(statuses[1]).toMatchObject({ errorCode: "131047", errorText: "Re-engagement message" });
  });

  it.each([null, undefined, "x", 5, {}, { entry: "no" }, { entry: [null, {}, { changes: [{}] }] }])("survives garbage %#", (p) => {
    expect(parseWebhook(p)).toEqual({ messages: [], statuses: [], reactions: [] });
  });

  it("skips a message with no sender or id instead of failing the delivery", () => {
    expect(parseWebhook(inboundPayload({ from: "" })).messages).toHaveLength(0);
    expect(parseWebhook(inboundPayload({ id: undefined })).messages).toHaveLength(0);
  });

  it("waPhone adds the plus and rejects short ids", () => {
    expect(waPhone("34635383712")).toBe("+34635383712");
    expect(waPhone("123")).toBeNull();
    expect(waPhone(undefined)).toBeNull();
  });
});

describe("parseWebhook: replies, reactions and menu choices", () => {
  it("keeps what a message is a reply to", () => {
    const { messages } = parseWebhook(inboundPayload({ context: { id: "wamid.OUT1" } }));
    expect(messages[0].replyTo).toBe("wamid.OUT1");
    expect(parseWebhook(inboundPayload()).messages[0].replyTo).toBeNull();
  });

  it("treats a reaction as a reaction, never as a message or an alert", () => {
    const out = parseWebhook(inboundPayload({ type: "reaction", text: undefined, reaction: { message_id: "wamid.OUT1", emoji: "👍" } }));
    expect(out.messages).toHaveLength(0);
    expect(out.reactions).toEqual([expect.objectContaining({ id: "wamid.IN1", wamid: "wamid.OUT1", emoji: "👍", phone: "+34635383712" })]);
  });

  it("reads a removed reaction as an empty emoji", () => {
    const out = parseWebhook(inboundPayload({ type: "reaction", text: undefined, reaction: { message_id: "wamid.OUT1" } }));
    expect(out.reactions[0].emoji).toBe("");
  });

  it("ignores a reaction that names no message", () => {
    expect(parseWebhook(inboundPayload({ type: "reaction", text: undefined, reaction: { emoji: "👍" } })).reactions).toEqual([]);
  });

  it("returns the id of a list pick so a menu choice can be recognised", () => {
    const { messages } = parseWebhook(inboundPayload({ type: "interactive", text: undefined, interactive: { type: "list_reply", list_reply: { id: "svc:girona", title: "Girona" } } }));
    expect(messages[0]).toMatchObject({ text: "Girona", choiceId: "svc:girona" });
  });

  it("labels a voice note and a document with its name", () => {
    expect(parseWebhook(inboundPayload({ type: "audio", text: undefined, audio: { id: "A1", voice: true } })).messages[0].text).toBe("[voice]");
    const doc = parseWebhook(inboundPayload({ type: "document", text: undefined, document: { id: "D1", filename: "ticket.pdf" } })).messages[0];
    expect(doc).toMatchObject({ text: "[document] ticket.pdf", fileName: "ticket.pdf", mediaId: "D1" });
  });
});

describe("validMetaSignature", () => {
  const body = JSON.stringify(inboundPayload());
  it("accepts the exact signature over the exact bytes", () => {
    expect(validMetaSignature(body, sign(body), SECRET)).toBe(true);
  });
  it("refuses a different secret, a changed body, a missing header or a missing secret", () => {
    expect(validMetaSignature(body, sign(body, "other"), SECRET)).toBe(false);
    expect(validMetaSignature(body + " ", sign(body), SECRET)).toBe(false);
    expect(validMetaSignature(body, null, SECRET)).toBe(false);
    expect(validMetaSignature(body, sign(body), undefined)).toBe(false);
    expect(validMetaSignature(body, "sha256=", SECRET)).toBe(false);
  });
});

// ─── Conversations ───────────────────────────────────────────────────────────

const NOW = new Date("2026-10-03T12:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const row = (action: string, createdAt: Date, details: Record<string, unknown> = {}, entityId = "+34635383712"): LogRow =>
  ({ action, entityId, createdAt, details });
const inMsg = (h: number, text = "hi", extra: Record<string, unknown> = {}, phone?: string) =>
  row("WA_MESSAGE", ago(h), { dir: "in", wamid: `in-${h}-${text}`, text, type: "text", ...extra }, phone);
const outMsg = (h: number, wamid: string, text = "reply") =>
  row("WA_MESSAGE", ago(h), { dir: "out", wamid, text, type: "text", by: "Office" });

describe("buildConversations", () => {
  it("counts only customer messages after the last time the office looked as unread", () => {
    const rows = [inMsg(5, "a"), inMsg(4, "b"), row("WA_SEEN", ago(3.5)), inMsg(3, "c"), outMsg(2, "o1")];
    const [c] = buildConversations(rows, NOW);
    expect(c.unread).toBe(1);
    expect(c.lastDir).toBe("out");
    expect(c.lastText).toBe("reply");
  });

  it("sorts the most recent conversation first and keeps customers apart", () => {
    const rows = [inMsg(10, "old", {}, "+447000000001"), inMsg(1, "new", {}, "+34600000002")];
    expect(buildConversations(rows, NOW).map((c) => c.phone)).toEqual(["+34600000002", "+447000000001"]);
  });

  it("ignores status-only numbers", () => {
    expect(buildConversations([row("WA_STATUS", ago(1), { wamid: "x", status: "sent" })], NOW)).toEqual([]);
  });

  it("uses the newest known name", () => {
    const rows = [inMsg(5, "a", { name: "Ana" }), inMsg(1, "b", { name: "Ana M" })];
    expect(buildConversations(rows, NOW)[0].name).toBe("Ana M");
  });

  it("opens the window for 24 hours from the customer's last message, not ours", () => {
    const open = buildConversations([inMsg(23, "a"), outMsg(1, "o")], NOW)[0];
    expect(open.windowOpen).toBe(true);
    expect(new Date(open.windowEndsAt!).getTime()).toBe(ago(23).getTime() + SESSION_WINDOW_MS);
    const closed = buildConversations([inMsg(25, "a"), outMsg(1, "o")], NOW)[0];
    expect(closed.windowOpen).toBe(false);
  });
});

describe("canReplyFreely", () => {
  it("is true inside 24 hours of the customer's last message", () => {
    expect(canReplyFreely([inMsg(23.9)], NOW)).toBe(true);
  });
  it("is false after 24 hours, even if the office wrote recently", () => {
    expect(canReplyFreely([inMsg(24.1), outMsg(0.5, "o")], NOW)).toBe(false);
  });
  it("is false when the customer has never written", () => {
    expect(canReplyFreely([outMsg(1, "o")], NOW)).toBe(false);
    expect(canReplyFreely([], NOW)).toBe(false);
  });
});

describe("buildThread", () => {
  it("orders oldest first and attaches delivery state to our messages only", () => {
    const rows = [
      outMsg(2, "o1"), inMsg(3, "q"),
      row("WA_STATUS", ago(1.9), { wamid: "o1", status: "sent" }),
      row("WA_STATUS", ago(1.8), { wamid: "o1", status: "read" }),
      row("WA_STATUS", ago(1.7), { wamid: "o1", status: "delivered" }),
    ];
    const t = buildThread(rows);
    expect(t.map((m) => m.dir)).toEqual(["in", "out"]);
    expect(t[0].status).toBeNull();
    expect(t[1].status).toBe("read"); // never moves backwards
  });

  it("shows a failure and its reason", () => {
    const t = buildThread([
      outMsg(2, "o1"),
      row("WA_STATUS", ago(1.9), { wamid: "o1", status: "delivered" }),
      row("WA_STATUS", ago(1.8), { wamid: "o1", status: "failed", errorText: "Not on WhatsApp" }),
    ]);
    expect(t[0]).toMatchObject({ status: "failed", problem: "Not on WhatsApp" });
  });
});


describe("buildThread: quotes and reactions", () => {
  it("attaches the quoted message to a reply", () => {
    const t = buildThread([
      outMsg(3, "o1", "Your driver is Pedro"),
      row("WA_MESSAGE", ago(2), { dir: "in", wamid: "i1", text: "Thanks!", type: "text", replyTo: "o1" }),
    ]);
    expect(t[1].replyTo).toEqual({ wamid: "o1", text: "Your driver is Pedro", dir: "out", type: "text" });
  });

  it("keeps a quote even when the original is older than what was loaded", () => {
    const t = buildThread([row("WA_MESSAGE", ago(1), { dir: "in", wamid: "i1", text: "ok", type: "text", replyTo: "gone" })]);
    expect(t[0].replyTo).toMatchObject({ wamid: "gone", text: "" });
  });

  it("shows the latest reaction per side and drops a removed one", () => {
    const t = buildThread([
      inMsg(5, "hello"),
      row("WA_REACTION", ago(4), { id: "r1", wamid: "in-5-hello", emoji: "👍", dir: "out" }),
      row("WA_REACTION", ago(3), { id: "r2", wamid: "in-5-hello", emoji: "❤️", dir: "out" }),
      row("WA_REACTION", ago(2), { id: "r3", wamid: "in-5-hello", emoji: "😂", dir: "in" }),
      row("WA_REACTION", ago(1), { id: "r4", wamid: "in-5-hello", emoji: "", dir: "in" }),
    ]);
    expect(t[0].reactions).toEqual([{ emoji: "❤️", dir: "out" }]);
  });
});

describe("conversation list extras", () => {
  it("carries the tick for our last message and the customer's own last words", () => {
    const rows = [inMsg(5, "price?"), outMsg(2, "o1", "It is 50 euros"), row("WA_STATUS", ago(1.5), { wamid: "o1", status: "read" })];
    const [c] = buildConversations(rows, NOW);
    expect(c.lastStatus).toBe("read");
    expect(c.lastInText).toBe("price?");
    expect(c.lastInAt).toBe(ago(5).toISOString());
  });

  it("has no tick when the customer wrote last", () => {
    expect(buildConversations([outMsg(3, "o1"), inMsg(1, "hi")], NOW)[0].lastStatus).toBeNull();
  });

  it("windowEndsAt and latestInboundId follow the customer's newest message", () => {
    const rows = [inMsg(30, "old"), inMsg(2, "new"), outMsg(1, "o1")];
    expect(windowEndsAt(rows)).toBe(ago(2).getTime() + SESSION_WINDOW_MS);
    expect(latestInboundId(rows)).toBe("in-2-new");
    expect(windowEndsAt([outMsg(1, "o1")])).toBeNull();
    expect(latestInboundId([])).toBeNull();
  });
});

describe("summarize", () => {
  it("counts unread across chats and quotes the newest message from a customer", () => {
    const rows = [
      inMsg(6, "first", { name: "Ana" }, "+34600000001"),
      inMsg(2, "second", { name: "Luis" }, "+34600000002"),
      inMsg(1, "third", {}, "+34600000002"),
      row("WA_SEEN", ago(10), {}, "+34600000003"),
      inMsg(20, "read already", {}, "+34600000003"),
      row("WA_SEEN", ago(19), {}, "+34600000003"),
    ];
    const s = summarize(buildConversations(rows, NOW));
    expect(s.unread).toBe(3);
    expect(s.chats).toBe(2);
    expect(s.latest).toMatchObject({ phone: "+34600000002", text: "third" });
  });

  it("is empty when nothing is waiting", () => {
    expect(summarize(buildConversations([inMsg(3, "hi"), row("WA_SEEN", ago(1))], NOW))).toEqual({ unread: 0, chats: 0, latest: null });
  });

  it("does not quote our own reply as the thing a customer said", () => {
    const s = summarize(buildConversations([inMsg(5, "question"), outMsg(1, "o1", "our answer to someone else")].concat([inMsg(0.5, "new thing")]), NOW));
    expect(s.latest?.text).toBe("new thing");
  });
});
