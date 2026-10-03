import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import {
  parseWebhook, validMetaSignature, buildConversations, buildThread, canReplyFreely,
  waPhone, SESSION_WINDOW_MS, type LogRow,
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
    expect(parseWebhook(p)).toEqual({ messages: [], statuses: [] });
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

// ─── The routes ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  recordInbound: vi.fn(),
  recordStatus: vi.fn(),
  recordOutbound: vi.fn(),
  markSeen: vi.fn(),
  loadThread: vi.fn(),
  loadConversations: vi.fn(),
  notifyAdmin: vi.fn(),
  sendText: vi.fn(),
  findBooking: vi.fn(),
  session: vi.fn(),
}));

vi.mock("@/lib/whatsapp-inbox-store", () => ({
  recordInbound: mocks.recordInbound, recordStatus: mocks.recordStatus, recordOutbound: mocks.recordOutbound,
  markSeen: mocks.markSeen, loadThread: mocks.loadThread, loadConversations: mocks.loadConversations,
}));
vi.mock("@/lib/whatsapp", () => ({
  notifyAdmin: mocks.notifyAdmin, sendWhatsAppTextResult: mocks.sendText, whatsappConfigured: () => true,
  fetchWhatsAppMedia: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { booking: { findFirst: mocks.findBooking } } }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET as webhookGet, POST as webhookPost } from "@/app/api/whatsapp/webhook/route";
import { GET as adminThreadGet, POST as adminReply } from "@/app/api/admin/whatsapp/[phone]/route";
import { GET as adminList } from "@/app/api/admin/whatsapp/route";

const post = (body: string, headers: Record<string, string> = {}) =>
  new NextRequest("https://www.elitebcn.info/api/whatsapp/webhook", { method: "POST", body, headers });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WA_VERIFY_TOKEN", "verify-me");
  vi.stubEnv("WA_APP_SECRET", SECRET);
  mocks.recordInbound.mockResolvedValue(true);
  mocks.recordStatus.mockResolvedValue(true);
  mocks.notifyAdmin.mockResolvedValue(undefined);
  mocks.findBooking.mockResolvedValue(null);
  mocks.loadThread.mockResolvedValue({ messages: [], canReplyFreely: true });
  mocks.loadConversations.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe("webhook handshake", () => {
  const url = (q: string) => new NextRequest(`https://www.elitebcn.info/api/whatsapp/webhook?${q}`);
  it("echoes the challenge only for the right token", async () => {
    const ok = await webhookGet(url("hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345"));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("12345");
    expect((await webhookGet(url("hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1"))).status).toBe(403);
    expect((await webhookGet(url("hub.challenge=1"))).status).toBe(403);
  });
  it("refuses everything when no verify token is configured", async () => {
    vi.stubEnv("WA_VERIFY_TOKEN", "");
    expect((await webhookGet(url("hub.mode=subscribe&hub.verify_token=&hub.challenge=1"))).status).toBe(403);
  });
});

describe("webhook delivery", () => {
  const body = JSON.stringify(inboundPayload());

  it("stores nothing and tells nobody when the signature is wrong or absent", async () => {
    expect((await webhookPost(post(body, { "x-hub-signature-256": sign(body, "attacker") }))).status).toBe(403);
    expect((await webhookPost(post(body))).status).toBe(403);
    expect(mocks.recordInbound).not.toHaveBeenCalled();
    expect(mocks.notifyAdmin).not.toHaveBeenCalled();
  });

  it("refuses everything when the app secret is not configured", async () => {
    vi.stubEnv("WA_APP_SECRET", "");
    expect((await webhookPost(post(body, { "x-hub-signature-256": sign(body, "") }))).status).toBe(403);
    expect(mocks.recordInbound).not.toHaveBeenCalled();
  });

  it("stores a signed message and alerts the office once, with a link to the conversation", async () => {
    const res = await webhookPost(post(body, { "x-hub-signature-256": sign(body) }));
    expect(res.status).toBe(200);
    expect(mocks.recordInbound).toHaveBeenCalledTimes(1);
    expect(mocks.notifyAdmin).toHaveBeenCalledTimes(1);
    const text = mocks.notifyAdmin.mock.calls[0][0] as string;
    expect(text).toContain("Hello");
    expect(text).toContain("/admin/whatsapp?phone=%2B34635383712");
  });

  it("does not alert again when Meta retries a message already stored", async () => {
    mocks.recordInbound.mockResolvedValue(false);
    expect((await webhookPost(post(body, { "x-hub-signature-256": sign(body) }))).status).toBe(200);
    expect(mocks.notifyAdmin).not.toHaveBeenCalled();
  });

  it("still answers 200 if the alert fails", async () => {
    mocks.notifyAdmin.mockRejectedValue(new Error("down"));
    expect((await webhookPost(post(body, { "x-hub-signature-256": sign(body) }))).status).toBe(200);
    expect(mocks.recordInbound).toHaveBeenCalledTimes(1);
  });

  it("answers 500 when storing fails so Meta retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.recordInbound.mockRejectedValue(new Error("db down"));
    expect((await webhookPost(post(body, { "x-hub-signature-256": sign(body) }))).status).toBe(500);
  });

  it("answers 200 to a signed body that is not JSON or has nothing in it", async () => {
    const junk = "not json";
    expect((await webhookPost(post(junk, { "x-hub-signature-256": sign(junk) }))).status).toBe(200);
    const empty = JSON.stringify({ entry: [] });
    expect((await webhookPost(post(empty, { "x-hub-signature-256": sign(empty) }))).status).toBe(200);
  });

  it("records delivery statuses", async () => {
    const s = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "w1", status: "read", timestamp: "1790000000", recipient_id: "34635383712" }] } }] }] });
    expect((await webhookPost(post(s, { "x-hub-signature-256": sign(s) }))).status).toBe(200);
    expect(mocks.recordStatus).toHaveBeenCalledWith(expect.objectContaining({ wamid: "w1", status: "read" }));
  });
});

const ctx = (phone: string) => ({ params: Promise.resolve({ phone }) });
const reply = (text: unknown) =>
  new NextRequest("https://www.elitebcn.info/api/admin/whatsapp/x", { method: "POST", body: JSON.stringify({ text }) });
const asRole = (role: string | null) => mocks.session.mockResolvedValue(role ? { user: { role, name: "Sam" } } : null);

describe("admin routes", () => {
  it("refuse anyone who is not an admin", async () => {
    for (const role of [null, "DRIVER", "PARTNER"]) {
      asRole(role);
      expect((await adminList()).status).toBe(401);
      expect((await adminThreadGet(new NextRequest("https://x.test/y"), ctx("%2B34635383712"))).status).toBe(401);
      expect((await adminReply(reply("hi"), ctx("%2B34635383712"))).status).toBe(401);
    }
    expect(mocks.sendText).not.toHaveBeenCalled();
    expect(mocks.loadConversations).not.toHaveBeenCalled();
  });

  it("the list reports setup as booleans and never leaks the values", async () => {
    asRole("ADMIN");
    const body = await (await adminList()).json();
    expect(body.setup).toEqual({ sending: true, receiving: true });
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("sends a reply inside the window and records it as ours", async () => {
    asRole("ADMIN");
    mocks.sendText.mockResolvedValue({ outcome: "sent", id: "wamid.OUT" });
    const res = await adminReply(reply("On our way"), ctx("%2B34635383712"));
    expect(res.status).toBe(200);
    expect(mocks.sendText).toHaveBeenCalledWith("+34635383712", "On our way");
    expect(mocks.recordOutbound).toHaveBeenCalledWith({ phone: "+34635383712", wamid: "wamid.OUT", text: "On our way", by: "Sam" });
  });

  it("refuses a free-text reply outside 24 hours and sends nothing", async () => {
    asRole("ADMIN");
    mocks.loadThread.mockResolvedValue({ messages: [], canReplyFreely: false });
    const res = await adminReply(reply("hello?"), ctx("%2B34635383712"));
    expect(res.status).toBe(409);
    expect(mocks.sendText).not.toHaveBeenCalled();
    expect(mocks.recordOutbound).not.toHaveBeenCalled();
  });

  it("does not record a message WhatsApp did not accept", async () => {
    asRole("ADMIN");
    mocks.sendText.mockResolvedValue({ outcome: "failed", reason: "Token expired" });
    const res = await adminReply(reply("hi"), ctx("%2B34635383712"));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Token expired");
    expect(mocks.recordOutbound).not.toHaveBeenCalled();
  });

  it("rejects an empty reply and a bad phone", async () => {
    asRole("ADMIN");
    expect((await adminReply(reply("   "), ctx("%2B34635383712"))).status).toBe(422);
    expect((await adminReply(reply("hi"), ctx("abc"))).status).toBe(422);
    expect(mocks.sendText).not.toHaveBeenCalled();
  });
});
