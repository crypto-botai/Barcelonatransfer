import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { DEFAULT_SETTINGS, sanitizeSettings, type WhatsAppSettings } from "@/lib/whatsapp-settings";

/**
 * The WhatsApp routes: the public webhook and everything the admin screen calls.
 *
 * Database, WhatsApp and the price table are replaced, so no message is sent
 * and nothing is stored. What is checked is each route's decisions: who may
 * call it, what it refuses, what it sends, and what it records afterwards.
 * Nothing may be recorded as sent that WhatsApp did not accept.
 */

const SECRET = "app-secret";
const sign = (body: string, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

const mocks = vi.hoisted(() => ({
  recordInbound: vi.fn(), recordStatus: vi.fn(), recordReaction: vi.fn(), recordOutbound: vi.fn(), recordOutboundReaction: vi.fn(),
  markSeen: vi.fn(), loadThread: vi.fn(), loadConversations: vi.fn(), loadSummary: vi.fn(), inboxRevision: vi.fn(), lastOutboundTimes: vi.fn(),
  notifyAdmin: vi.fn(), sendText: vi.fn(), sendInteractive: vi.fn(), sendReaction: vi.fn(), sendMedia: vi.fn(), uploadMedia: vi.fn(),
  markRead: vi.fn(), getProfile: vi.fn(), updateProfile: vi.fn(), setPhoto: vi.fn(), push: vi.fn(),
  loadSettings: vi.fn(), saveSettings: vi.fn(), findBooking: vi.fn(), session: vi.fn(), prices: vi.fn(),
}));

vi.mock("@/lib/whatsapp-inbox-store", () => ({
  recordInbound: mocks.recordInbound, recordStatus: mocks.recordStatus, recordReaction: mocks.recordReaction,
  recordOutbound: mocks.recordOutbound, recordOutboundReaction: mocks.recordOutboundReaction, markSeen: mocks.markSeen,
  loadThread: mocks.loadThread, loadConversations: mocks.loadConversations, loadSummary: mocks.loadSummary,
  inboxRevision: mocks.inboxRevision, lastOutboundTimes: mocks.lastOutboundTimes,
}));
vi.mock("@/lib/whatsapp", async () => {
  const files = await vi.importActual<typeof import("@/lib/whatsapp-files")>("@/lib/whatsapp-files");
  return {
    MAX_MEDIA_BYTES: files.MAX_MEDIA_BYTES, SENDABLE_MEDIA: files.SENDABLE_MEDIA,
    notifyAdmin: mocks.notifyAdmin, whatsappConfigured: () => true, fetchWhatsAppMedia: vi.fn().mockResolvedValue(null),
    sendWhatsAppTextResult: mocks.sendText, sendWhatsAppInteractive: mocks.sendInteractive, sendWhatsAppReaction: mocks.sendReaction,
    sendWhatsAppMedia: mocks.sendMedia, uploadWhatsAppMedia: mocks.uploadMedia, markWhatsAppRead: mocks.markRead,
    getWhatsAppProfile: mocks.getProfile, updateWhatsAppProfile: mocks.updateProfile, setWhatsAppProfilePhoto: mocks.setPhoto,
  };
});
vi.mock("@/lib/whatsapp-alerts", () => ({ pushNewMessageToAdmins: mocks.push }));
vi.mock("@/lib/whatsapp-settings-store", () => ({ loadSettings: mocks.loadSettings, saveSettings: mocks.saveSettings }));
vi.mock("@/lib/destination-pricing", () => ({ getDestinationPrices: mocks.prices }));
vi.mock("@/lib/notifications/push", () => ({ isPushConfigured: () => true }));
vi.mock("@/lib/prisma", () => ({ prisma: { booking: { findFirst: mocks.findBooking } } }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET as webhookGet, POST as webhookPost } from "@/app/api/whatsapp/webhook/route";
import { GET as listGet } from "@/app/api/admin/whatsapp/route";
import { GET as summaryGet } from "@/app/api/admin/whatsapp/summary/route";
import { GET as threadGet, PUT as threadPut, POST as threadPost } from "@/app/api/admin/whatsapp/[phone]/route";
import { POST as mediaPost } from "@/app/api/admin/whatsapp/[phone]/media/route";
import { GET as settingsGet, PUT as settingsPut } from "@/app/api/admin/whatsapp/settings/route";
import { GET as profileGet, PUT as profilePut } from "@/app/api/admin/whatsapp/profile/route";
import { POST as photoPost } from "@/app/api/admin/whatsapp/profile/photo/route";
import { GET as catalogGet } from "@/app/api/whatsapp/catalog/route";

const PHONE = "%2B34635383712";
const E164 = "+34635383712";
const ctx = (phone = PHONE) => ({ params: Promise.resolve({ phone }) });
const asRole = (role: string | null) => mocks.session.mockResolvedValue(role ? { user: { role, name: "Sam" } } : null);
const req = (url: string, init?: RequestInit) => new NextRequest(`https://www.elitebcn.info${url}`, init as ConstructorParameters<typeof NextRequest>[1]);
const jsonReq = (body: unknown, method = "POST") => req("/x", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const inboundPayload = (over: Record<string, unknown> = {}) => ({
  entry: [{ changes: [{ value: {
    contacts: [{ wa_id: "34635383712", profile: { name: "Ana" } }],
    messages: [{ from: "34635383712", id: "wamid.IN1", timestamp: "1790000000", type: "text", text: { body: "Hello" }, ...over }],
  } }] }],
});
const post = (body: string, headers: Record<string, string> = {}) =>
  req("/api/whatsapp/webhook", { method: "POST", body, headers });

let settings: WhatsAppSettings;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WA_VERIFY_TOKEN", "verify-me");
  vi.stubEnv("WA_APP_SECRET", SECRET);
  settings = DEFAULT_SETTINGS;
  mocks.recordInbound.mockResolvedValue(true);
  mocks.recordStatus.mockResolvedValue(true);
  mocks.recordReaction.mockResolvedValue(true);
  mocks.notifyAdmin.mockResolvedValue(undefined);
  mocks.push.mockResolvedValue(1);
  mocks.findBooking.mockResolvedValue(null);
  mocks.loadSettings.mockImplementation(async () => settings);
  mocks.saveSettings.mockImplementation(async (input: unknown) => sanitizeSettings(input));
  mocks.lastOutboundTimes.mockResolvedValue({ lastOutboundAt: null, lastAutoAt: null });
  mocks.inboxRevision.mockResolvedValue("rev-1");
  mocks.markSeen.mockResolvedValue(null);
  mocks.loadThread.mockResolvedValue({ messages: [], canReplyFreely: true, latestInboundId: "wamid.IN1", windowEndsAt: new Date(Date.now() + 3_600_000).toISOString() });
  mocks.loadConversations.mockResolvedValue([]);
  mocks.loadSummary.mockResolvedValue({ unread: 0, chats: 0, latest: null });
  mocks.sendText.mockResolvedValue({ outcome: "sent", id: "wamid.OUT" });
  mocks.sendInteractive.mockResolvedValue({ outcome: "sent", id: "wamid.OUT" });
  mocks.sendReaction.mockResolvedValue({ outcome: "sent" });
  mocks.sendMedia.mockResolvedValue({ outcome: "sent", id: "wamid.OUT" });
  mocks.uploadMedia.mockResolvedValue({ ok: true, id: "MEDIA1" });
  mocks.markRead.mockResolvedValue(undefined);
  mocks.prices.mockImplementation(async (zone: string) => ({ barcelona_city: { economy: 50 }, tossa: { economy: 155 }, girona_city: { economy: 165 }, lloret: { economy: 145 }, sitges: { economy: 80 } } as Record<string, { economy: number }>)[zone] ?? null);
  asRole("ADMIN");
});
afterEach(() => vi.unstubAllEnvs());

// ─── Webhook ─────────────────────────────────────────────────────────────────

describe("webhook handshake", () => {
  const url = (q: string) => req(`/api/whatsapp/webhook?${q}`);
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

describe("webhook: who is believed", () => {
  const body = JSON.stringify(inboundPayload());

  it("stores nothing and tells nobody when the signature is wrong or absent", async () => {
    expect((await webhookPost(post(body, { "x-hub-signature-256": sign(body, "attacker") }))).status).toBe(403);
    expect((await webhookPost(post(body))).status).toBe(403);
    expect(mocks.recordInbound).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it("refuses everything when the app secret is not configured", async () => {
    vi.stubEnv("WA_APP_SECRET", "");
    expect((await webhookPost(post(body, { "x-hub-signature-256": sign(body, "") }))).status).toBe(403);
    expect(mocks.recordInbound).not.toHaveBeenCalled();
  });

  it("answers 200 to a signed body that is not JSON or has nothing in it", async () => {
    for (const b of ["not json", JSON.stringify({ entry: [] })]) {
      expect((await webhookPost(post(b, { "x-hub-signature-256": sign(b) }))).status).toBe(200);
    }
  });
});

describe("webhook: a new message", () => {
  const send = async (payload: unknown = inboundPayload()) => {
    const body = JSON.stringify(payload);
    return webhookPost(post(body, { "x-hub-signature-256": sign(body) }));
  };

  it("is stored, alerts the desktop, and emails the office with a link to the chat", async () => {
    expect((await send()).status).toBe(200);
    expect(mocks.recordInbound).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith(expect.objectContaining({ phone: E164, name: "Ana", text: "Hello" }));
    const email = mocks.notifyAdmin.mock.calls[0][0] as string;
    expect(email).toContain("Hello");
    expect(email).toContain("/admin/whatsapp?phone=%2B34635383712");
  });

  it("skips the email when the office has turned it off, but still alerts the desktop", async () => {
    settings = { ...DEFAULT_SETTINGS, emailAlerts: false };
    await send();
    expect(mocks.notifyAdmin).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });

  it("does nothing more when Meta retries a message already stored", async () => {
    mocks.recordInbound.mockResolvedValue(false);
    expect((await send()).status).toBe(200);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.notifyAdmin).not.toHaveBeenCalled();
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it("answers 500 when storing fails, so Meta retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.recordInbound.mockRejectedValue(new Error("db down"));
    expect((await send()).status).toBe(500);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("still answers 200 when an alert or the follow-up fails: the message is already stored", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.push.mockRejectedValue(new Error("push down"));
    mocks.notifyAdmin.mockRejectedValue(new Error("mail down"));
    mocks.loadSettings.mockRejectedValue(new Error("settings down"));
    expect((await send()).status).toBe(200);
    expect(mocks.recordInbound).toHaveBeenCalledTimes(1);
  });

  it("records delivery statuses", async () => {
    await send({ entry: [{ changes: [{ value: { statuses: [{ id: "w1", status: "read", timestamp: "1790000000", recipient_id: "34635383712" }] } }] }] });
    expect(mocks.recordStatus).toHaveBeenCalledWith(expect.objectContaining({ wamid: "w1", status: "read" }));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("stores a reaction without alerting anyone or replying", async () => {
    await send(inboundPayload({ type: "reaction", text: undefined, reaction: { message_id: "wamid.OUT1", emoji: "👍" } }));
    expect(mocks.recordReaction).toHaveBeenCalledWith(expect.objectContaining({ wamid: "wamid.OUT1", emoji: "👍" }));
    expect(mocks.recordInbound).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.sendText).not.toHaveBeenCalled();
  });
});

describe("webhook: choosing from the services menu", () => {
  const pick = (id: string) =>
    inboundPayload({ type: "interactive", text: undefined, interactive: { type: "list_reply", list_reply: { id, title: "Tossa de Mar" } } });
  const send = async (payload: unknown) => { const b = JSON.stringify(payload); return webhookPost(post(b, { "x-hub-signature-256": sign(b) })); };

  it("answers with the picture, the live price and a Book button, as a reply to the choice", async () => {
    await send(pick("svc:tossa-de-mar"));
    const [to, interactive, opts] = mocks.sendInteractive.mock.calls[0];
    expect(to).toBe(E164);
    expect(opts).toEqual({ replyTo: "wamid.IN1" });
    expect(interactive.type).toBe("cta_url");
    expect(interactive.body.text).toContain("from €155");
    expect(interactive.action.parameters.url).toBe("https://www.elitebcn.info/transfers/tossa-de-mar");
    expect(interactive.header.image.link).toBe("https://www.elitebcn.info/whatsapp/tossa-de-mar.jpg");
    expect(mocks.recordOutbound).toHaveBeenCalledWith(expect.objectContaining({ by: "Services menu", wamid: "wamid.OUT", replyTo: "wamid.IN1" }));
  });

  it("quotes the price table, so a price changed in the admin changes the answer", async () => {
    mocks.prices.mockImplementation(async (zone: string) => (zone === "tossa" ? { economy: 170 } : null));
    await send(pick("svc:tossa-de-mar"));
    expect(mocks.sendInteractive.mock.calls[0][1].body.text).toContain("from €170");
  });

  it("does not record an answer WhatsApp did not accept", async () => {
    mocks.sendInteractive.mockResolvedValue({ outcome: "failed", reason: "nope" });
    await send(pick("svc:tossa-de-mar"));
    expect(mocks.recordOutbound).not.toHaveBeenCalled();
  });

  it("does not offer a service the office has switched off", async () => {
    settings = { ...DEFAULT_SETTINGS, services: DEFAULT_SETTINGS.services.map((s) => ({ ...s, id: s.id, enabled: s.id === "tossa-de-mar" ? true : s.enabled })) };
    await send(pick("svc:sitges"));
    expect(mocks.sendInteractive).toHaveBeenCalledTimes(1); // sitges is still on in this setup
    mocks.sendInteractive.mockClear();
    await send(pick("svc:no-such-service"));
    expect(mocks.sendInteractive).not.toHaveBeenCalled();
  });

  it("an ordinary reply that merely mentions a service is not a menu choice", async () => {
    await send(inboundPayload({ text: { body: "svc:tossa-de-mar" } }));
    expect(mocks.sendInteractive).not.toHaveBeenCalled();
  });
});

describe("webhook: automatic replies", () => {
  const send = async () => { const b = JSON.stringify(inboundPayload()); return webhookPost(post(b, { "x-hub-signature-256": sign(b) })); };

  it("sends nothing by default", async () => {
    await send();
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it("sends the welcome when it is on and due, and records it as automatic", async () => {
    settings = { ...DEFAULT_SETTINGS, welcome: { enabled: true, text: "Welcome to Elite BCN" } };
    await send();
    expect(mocks.sendText).toHaveBeenCalledWith(E164, "Welcome to Elite BCN");
    expect(mocks.recordOutbound).toHaveBeenCalledWith({ phone: E164, wamid: "wamid.OUT", text: "Welcome to Elite BCN", by: "Auto-reply" });
  });

  it("does not interrupt a conversation someone is already having", async () => {
    settings = { ...DEFAULT_SETTINGS, welcome: { enabled: true, text: "Welcome" } };
    mocks.lastOutboundTimes.mockResolvedValue({ lastOutboundAt: new Date(Date.now() - 600_000), lastAutoAt: null });
    await send();
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it("does not record an automatic reply that WhatsApp refused", async () => {
    settings = { ...DEFAULT_SETTINGS, welcome: { enabled: true, text: "Welcome" } };
    mocks.sendText.mockResolvedValue({ outcome: "failed", reason: "nope" });
    await send();
    expect(mocks.recordOutbound).not.toHaveBeenCalled();
  });
});

// ─── Admin: who may call ─────────────────────────────────────────────────────

describe("admin routes refuse everyone who is not an admin", () => {
  const calls: [string, () => Promise<Response>][] = [
    ["list", () => listGet(req("/api/admin/whatsapp"))],
    ["summary", () => summaryGet(req("/api/admin/whatsapp/summary"))],
    ["thread GET", () => threadGet(req("/x"), ctx())],
    ["thread PUT", () => threadPut(req("/x", { method: "PUT" }), ctx())],
    ["thread POST", () => threadPost(jsonReq({ text: "hi" }), ctx())],
    ["media POST", () => mediaPost(req("/x", { method: "POST", body: new FormData() }), ctx())],
    ["settings GET", () => settingsGet()],
    ["settings PUT", () => settingsPut(jsonReq({}, "PUT"))],
    ["profile GET", () => profileGet()],
    ["profile PUT", () => profilePut(jsonReq({}, "PUT"))],
    ["photo POST", () => photoPost(jsonReq({ useLogo: true }))],
  ];

  for (const role of [null, "DRIVER", "PARTNER", "CUSTOMER"]) {
    it(`as ${role ?? "a signed-out visitor"}`, async () => {
      asRole(role);
      for (const [name, call] of calls) expect(((await call()).status), name).toBe(401);
      expect(mocks.sendText).not.toHaveBeenCalled();
      expect(mocks.sendInteractive).not.toHaveBeenCalled();
      expect(mocks.uploadMedia).not.toHaveBeenCalled();
      expect(mocks.setPhoto).not.toHaveBeenCalled();
      expect(mocks.updateProfile).not.toHaveBeenCalled();
      expect(mocks.saveSettings).not.toHaveBeenCalled();
      expect(mocks.loadConversations).not.toHaveBeenCalled();
    });
  }
});

// ─── Admin: reading ──────────────────────────────────────────────────────────

describe("inbox and summary", () => {
  it("send the whole inbox, with setup as booleans and never as values", async () => {
    const body = await (await listGet(req("/api/admin/whatsapp"))).json();
    expect(body).toMatchObject({ rev: "rev-1", conversations: [], setup: { sending: true, receiving: true } });
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("send a few bytes when nothing has changed since the revision the page already holds", async () => {
    const list = await (await listGet(req("/api/admin/whatsapp?rev=rev-1"))).json();
    expect(list).toEqual({ unchanged: true, rev: "rev-1" });
    expect(mocks.loadConversations).not.toHaveBeenCalled();
    const sum = await (await summaryGet(req("/api/admin/whatsapp/summary?rev=rev-1"))).json();
    expect(sum).toEqual({ unchanged: true, rev: "rev-1" });
    expect(mocks.loadSummary).not.toHaveBeenCalled();
  });

  it("send the new data once the revision has moved", async () => {
    mocks.loadSummary.mockResolvedValue({ unread: 2, chats: 1, latest: { phone: E164, name: "Ana", text: "hi", at: "2026-10-03T10:00:00.000Z" } });
    const sum = await (await summaryGet(req("/api/admin/whatsapp/summary?rev=old"))).json();
    expect(sum).toMatchObject({ rev: "rev-1", unread: 2, chats: 1 });
  });

  it("thread: returns the chat, the window and the booking, and is quiet when unchanged", async () => {
    mocks.findBooking.mockResolvedValue({ id: "b1", confirmationCode: "EBC-1", status: "CONFIRMED", guestName: "Ana", pickupAddress: "T1", dropoffAddress: "Hotel", pickupDatetime: new Date() });
    const body = await (await threadGet(req("/x"), ctx())).json();
    expect(body).toMatchObject({ phone: E164, canReplyFreely: true, booking: { confirmationCode: "EBC-1" } });
    expect(body.windowEndsAt).toBeTruthy();
    expect(mocks.findBooking.mock.calls[0][0].where.guestPhone).toBe(E164);
    mocks.loadThread.mockClear();
    expect(await (await threadGet(req("/x?rev=rev-1"), ctx())).json()).toEqual({ unchanged: true, rev: "rev-1" });
    expect(mocks.loadThread).not.toHaveBeenCalled();
  });

  it("thread: a bad number is refused, and a booking lookup failure does not break the chat", async () => {
    expect((await threadGet(req("/x"), ctx("abc"))).status).toBe(422);
    mocks.findBooking.mockRejectedValue(new Error("db"));
    const res = await threadGet(req("/x"), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).booking).toBeNull();
  });
});

describe("opening a chat", () => {
  it("clears the unread count and tells the customer by turning their ticks blue", async () => {
    mocks.markSeen.mockResolvedValue("wamid.IN9");
    expect((await threadPut(req("/x", { method: "PUT" }), ctx())).status).toBe(200);
    expect(mocks.markRead).toHaveBeenCalledWith("wamid.IN9");
  });

  it("sends no read receipt when there was nothing new", async () => {
    mocks.markSeen.mockResolvedValue(null);
    await threadPut(req("/x", { method: "PUT" }), ctx());
    expect(mocks.markRead).not.toHaveBeenCalled();
  });

  it("refuses a bad number", async () => {
    expect((await threadPut(req("/x", { method: "PUT" }), ctx("abc"))).status).toBe(422);
    expect(mocks.markSeen).not.toHaveBeenCalled();
  });
});

// ─── Admin: sending ──────────────────────────────────────────────────────────

describe("replying", () => {
  it("sends a message and records it as the office's", async () => {
    const res = await threadPost(jsonReq({ text: "On our way" }), ctx());
    expect(res.status).toBe(200);
    expect(mocks.sendText).toHaveBeenCalledWith(E164, "On our way", { replyTo: undefined });
    expect(mocks.recordOutbound).toHaveBeenCalledWith({ phone: E164, wamid: "wamid.OUT", text: "On our way", by: "Sam", replyTo: null });
  });

  it("quotes the message being answered", async () => {
    await threadPost(jsonReq({ text: "Yes", replyTo: "wamid.IN1" }), ctx());
    expect(mocks.sendText).toHaveBeenCalledWith(E164, "Yes", { replyTo: "wamid.IN1" });
    expect(mocks.recordOutbound).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "wamid.IN1" }));
  });

  it("refuses everything free-form outside 24 hours, and sends nothing", async () => {
    mocks.loadThread.mockResolvedValue({ messages: [], canReplyFreely: false, latestInboundId: null, windowEndsAt: null });
    for (const body of [{ text: "hello?" }, { reaction: { wamid: "w", emoji: "👍" } }, { menu: true }, { service: "sitges" }]) {
      expect((await threadPost(jsonReq(body), ctx())).status).toBe(409);
    }
    expect(mocks.sendText).not.toHaveBeenCalled();
    expect(mocks.sendInteractive).not.toHaveBeenCalled();
    expect(mocks.sendReaction).not.toHaveBeenCalled();
    expect(mocks.recordOutbound).not.toHaveBeenCalled();
  });

  it("does not record a message WhatsApp did not accept, and says why", async () => {
    mocks.sendText.mockResolvedValue({ outcome: "failed", reason: "Token expired" });
    const res = await threadPost(jsonReq({ text: "hi" }), ctx());
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Token expired");
    expect(mocks.recordOutbound).not.toHaveBeenCalled();
  });

  it("rejects an empty message, nonsense and a bad number", async () => {
    for (const body of [{ text: "   " }, {}, { text: 5 }, { reaction: { wamid: "", emoji: "x" } }, { service: "" }, { menu: false }]) {
      expect((await threadPost(jsonReq(body), ctx())).status, JSON.stringify(body)).toBe(422);
    }
    expect((await threadPost(jsonReq({ text: "hi" }), ctx("abc"))).status).toBe(422);
    expect((await threadPost(req("/x", { method: "POST", body: "not json" }), ctx())).status).toBe(422);
    expect(mocks.sendText).not.toHaveBeenCalled();
  });
});

describe("reactions", () => {
  it("are sent and recorded", async () => {
    expect((await threadPost(jsonReq({ reaction: { wamid: "wamid.IN1", emoji: "👍" } }), ctx())).status).toBe(200);
    expect(mocks.sendReaction).toHaveBeenCalledWith(E164, "wamid.IN1", "👍");
    expect(mocks.recordOutboundReaction).toHaveBeenCalledWith({ phone: E164, wamid: "wamid.IN1", emoji: "👍" });
  });
  it("are not recorded when WhatsApp refuses", async () => {
    mocks.sendReaction.mockResolvedValue({ outcome: "failed", reason: "no" });
    expect((await threadPost(jsonReq({ reaction: { wamid: "w", emoji: "👍" } }), ctx())).status).toBe(502);
    expect(mocks.recordOutboundReaction).not.toHaveBeenCalled();
  });
});

describe("services from the inbox", () => {
  it("sends the whole menu with live prices and records it", async () => {
    expect((await threadPost(jsonReq({ menu: true }), ctx())).status).toBe(200);
    const [to, menu] = mocks.sendInteractive.mock.calls[0];
    expect(to).toBe(E164);
    expect(menu.type).toBe("list");
    const rows = menu.action.sections[0].rows as { title: string; description: string }[];
    expect(rows).toHaveLength(7);
    expect(rows.find((r) => r.title === "Tossa de Mar")?.description).toContain("€155");
    expect(rows.find((r) => r.title === "Airport to City")?.description).toContain("€50");
    expect(mocks.recordOutbound).toHaveBeenCalledWith(expect.objectContaining({ by: "Sam", wamid: "wamid.OUT" }));
  });

  it("explains when no service is switched on, and sends nothing", async () => {
    settings = { ...DEFAULT_SETTINGS, services: DEFAULT_SETTINGS.services.map((s) => ({ ...s, enabled: false })) };
    const res = await threadPost(jsonReq({ menu: true }), ctx());
    expect(res.status).toBe(422);
    expect(mocks.sendInteractive).not.toHaveBeenCalled();
  });

  it("sends one service as a Book now message", async () => {
    expect((await threadPost(jsonReq({ service: "girona" }), ctx())).status).toBe(200);
    const interactive = mocks.sendInteractive.mock.calls[0][1];
    expect(interactive.type).toBe("cta_url");
    expect(interactive.body.text).toContain("from €165");
  });

  it("refuses a service that does not exist or is off", async () => {
    expect((await threadPost(jsonReq({ service: "atlantis" }), ctx())).status).toBe(404);
    settings = { ...DEFAULT_SETTINGS, services: DEFAULT_SETTINGS.services.map((s) => (s.id === "sitges" ? { ...s, enabled: false } : s)) };
    expect((await threadPost(jsonReq({ service: "sitges" }), ctx())).status).toBe(404);
    expect(mocks.sendInteractive).not.toHaveBeenCalled();
  });

  it("does not record what WhatsApp refused", async () => {
    mocks.sendInteractive.mockResolvedValue({ outcome: "failed", reason: "bad menu" });
    expect((await threadPost(jsonReq({ menu: true }), ctx())).status).toBe(502);
    expect((await threadPost(jsonReq({ service: "girona" }), ctx())).status).toBe(502);
    expect(mocks.recordOutbound).not.toHaveBeenCalled();
  });
});

describe("sending a file", () => {
  const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], "map.png", { type: "image/png" });
  const form = (file: File | null, extra: Record<string, string> = {}) => {
    const f = new FormData();
    if (file) f.append("file", file);
    for (const [k, v] of Object.entries(extra)) f.append(k, v);
    return req("/x", { method: "POST", body: f });
  };

  it("uploads, sends and records a photo with its caption", async () => {
    const res = await mediaPost(form(png(), { caption: "Meeting point", replyTo: "wamid.IN1" }), ctx());
    expect(res.status).toBe(200);
    expect(mocks.uploadMedia.mock.calls[0].slice(1)).toEqual(["image/png", "map.png"]);
    expect(mocks.sendMedia).toHaveBeenCalledWith(E164, { kind: "image", mediaId: "MEDIA1", caption: "Meeting point", filename: "map.png", replyTo: "wamid.IN1" });
    expect(mocks.recordOutbound).toHaveBeenCalledWith(expect.objectContaining({ type: "image", mediaId: "MEDIA1", fileName: null, text: "[image] Meeting point", replyTo: "wamid.IN1" }));
  });

  it("records a document with its file name", async () => {
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 1])], "voucher.pdf", { type: "application/pdf" });
    await mediaPost(form(pdf), ctx());
    expect(mocks.sendMedia.mock.calls[0][1].kind).toBe("document");
    expect(mocks.recordOutbound).toHaveBeenCalledWith(expect.objectContaining({ type: "document", fileName: "voucher.pdf", text: "[document] voucher.pdf" }));
  });

  it("makes a hostile file name safe before it is stored or sent", async () => {
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], '..\\..\\x:"y".pdf', { type: "application/pdf" });
    await mediaPost(form(pdf), ctx());
    expect(mocks.uploadMedia.mock.calls[0][2]).not.toMatch(/[\\/:"]/);
  });

  it("refuses a missing file, an unsupported type, an empty file and an oversize one", async () => {
    expect((await mediaPost(form(null), ctx())).status).toBe(422);
    expect((await mediaPost(form(new File(["x"], "a.exe", { type: "application/x-msdownload" })), ctx())).status).toBe(415);
    expect((await mediaPost(form(new File(["<svg/>"], "a.svg", { type: "image/svg+xml" })), ctx())).status).toBe(415);
    expect((await mediaPost(form(new File([], "e.png", { type: "image/png" })), ctx())).status).toBe(422);
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    expect((await mediaPost(form(big), ctx())).status).toBe(413);
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
  });

  it("refuses a file that is not what it claims to be", async () => {
    const fake = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], "photo.png", { type: "image/png" });
    const res = await mediaPost(form(fake), ctx());
    expect(res.status).toBe(415);
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
  });

  it("refuses outside the 24-hour window, before uploading anything", async () => {
    mocks.loadThread.mockResolvedValue({ messages: [], canReplyFreely: false, latestInboundId: null, windowEndsAt: null });
    expect((await mediaPost(form(png()), ctx())).status).toBe(409);
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
  });

  it("does not record a file that failed to upload or to send", async () => {
    mocks.uploadMedia.mockResolvedValue({ ok: false, reason: "Upload refused" });
    const up = await mediaPost(form(png()), ctx());
    expect(up.status).toBe(502);
    expect((await up.json()).error).toBe("Upload refused");
    mocks.uploadMedia.mockResolvedValue({ ok: true, id: "M" });
    mocks.sendMedia.mockResolvedValue({ outcome: "failed", reason: "Send refused" });
    expect((await mediaPost(form(png()), ctx())).status).toBe(502);
    expect(mocks.recordOutbound).not.toHaveBeenCalled();
  });

  it("refuses a bad number", async () => {
    expect((await mediaPost(form(png()), ctx("abc"))).status).toBe(422);
  });
});

// ─── Admin: settings, profile, photo, catalogue ─────────────────────────────

describe("settings", () => {
  it("shows what is saved, the live price beside each service, and the catalogue address", async () => {
    const body = await (await settingsGet()).json();
    expect(body.settings.services).toHaveLength(7);
    expect(body.services.find((s: { id: string }) => s.id === "tossa-de-mar").fromPrice).toBe(155);
    expect(body.catalogFeedUrl).toBe("https://www.elitebcn.info/api/whatsapp/catalog");
    expect(body.pushConfigured).toBe(true);
  });

  it("cleans what is saved and says who saved it", async () => {
    const res = await settingsPut(jsonReq({ services: [{ id: "x", title: "T".repeat(100), path: "https://evil.example" }], welcome: { enabled: true, text: "Hi" } }, "PUT"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mocks.saveSettings).toHaveBeenCalledWith(expect.anything(), "Sam");
    expect(body.settings.services[0].title).toHaveLength(24);
    expect(body.settings.services[0].path).toBe("/book");
    expect(body.settings.welcome).toMatchObject({ enabled: true, text: "Hi" });
  });

  it("refuses a body that is not a settings object", async () => {
    for (const body of [null, "x", 5]) expect((await settingsPut(jsonReq(body, "PUT"))).status).toBe(422);
    expect((await settingsPut(req("/x", { method: "PUT", body: "not json" }))).status).toBe(422);
    expect(mocks.saveSettings).not.toHaveBeenCalled();
  });
});

describe("profile", () => {
  const good = { about: "Private chauffeur transfers", description: "Barcelona", address: "Carrer Llull 465", email: "booking@elitebcn.info", vertical: "Travel and Transportation", websites: ["https://www.elitebcn.info"] };

  it("reads the profile, and reports Meta's reason when it cannot", async () => {
    mocks.getProfile.mockResolvedValue({ ok: true, profile: { ...good, profile_picture_url: null } });
    expect((await (await profileGet()).json()).about).toBe(good.about);
    mocks.getProfile.mockResolvedValue({ ok: false, reason: "token expired" });
    const res = await profileGet();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("token expired");
  });

  it("saves a valid profile", async () => {
    mocks.updateProfile.mockResolvedValue({ ok: true });
    expect((await profilePut(jsonReq(good, "PUT"))).status).toBe(200);
    expect(mocks.updateProfile).toHaveBeenCalledWith(good);
  });

  it("refuses what WhatsApp would refuse, and names the field", async () => {
    const bad: [Record<string, unknown>, string][] = [
      [{ ...good, about: "a".repeat(140) }, "about"],
      [{ ...good, about: "" }, "about"],
      [{ ...good, description: "d".repeat(513) }, "description"],
      [{ ...good, address: "a".repeat(257) }, "address"],
      [{ ...good, email: "not-an-email" }, "email"],
      [{ ...good, websites: ["not a url"] }, "websites"],
      [{ ...good, websites: ["ftp://x.com"] }, "websites"],
      [{ ...good, websites: ["https://a.com", "https://b.com", "https://c.com"] }, "websites"],
    ];
    for (const [body, field] of bad) {
      const res = await profilePut(jsonReq(body, "PUT"));
      expect(res.status, field).toBe(422);
      expect((await res.json()).error, field).toContain(field);
    }
    expect((await profilePut(jsonReq(null, "PUT"))).status).toBe(422);
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("accepts an empty email and website", async () => {
    mocks.updateProfile.mockResolvedValue({ ok: true });
    expect((await profilePut(jsonReq({ ...good, email: "", websites: [] }, "PUT"))).status).toBe(200);
  });

  it("reports Meta's refusal", async () => {
    mocks.updateProfile.mockResolvedValue({ ok: false, reason: "Invalid parameter" });
    const res = await profilePut(jsonReq(good, "PUT"));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Invalid parameter");
  });
});

describe("profile photo", () => {
  const upload = (file: File | null) => { const f = new FormData(); if (file) f.append("file", file); return req("/x", { method: "POST", body: f }); };

  beforeEach(() => { mocks.setPhoto.mockResolvedValue({ ok: true }); });
  afterEach(() => vi.unstubAllGlobals());

  it("uses the Elite BCN logo from our own site", async () => {
    const logo = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => logo.buffer });
    vi.stubGlobal("fetch", fetchMock);
    expect((await photoPost(jsonReq({ useLogo: true }))).status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("https://www.elitebcn.info/brand/whatsapp-profile.jpg");
    expect(mocks.setPhoto.mock.calls[0][1]).toBe("image/jpeg");
  });

  it("says so when the logo cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect((await photoPost(jsonReq({ useLogo: true }))).status).toBe(502);
    expect(mocks.setPhoto).not.toHaveBeenCalled();
  });

  it("asks to choose a photo when told neither to use the logo nor given one", async () => {
    expect((await photoPost(jsonReq({}))).status).toBe(422);
    expect((await photoPost(upload(null))).status).toBe(422);
  });

  it("accepts an uploaded JPEG or PNG", async () => {
    expect((await photoPost(upload(new File([new Uint8Array([1, 2, 3])], "me.jpg", { type: "image/jpeg" })))).status).toBe(200);
    expect(mocks.setPhoto.mock.calls[0][1]).toBe("image/jpeg");
  });

  it("refuses other types and anything over 4 MB", async () => {
    expect((await photoPost(upload(new File(["x"], "a.gif", { type: "image/gif" })))).status).toBe(415);
    expect((await photoPost(upload(new File(["x"], "a.svg", { type: "image/svg+xml" })))).status).toBe(415);
    expect((await photoPost(upload(new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })))).status).toBe(413);
    expect(mocks.setPhoto).not.toHaveBeenCalled();
  });

  it("reports Meta's reason when the change is refused", async () => {
    mocks.setPhoto.mockResolvedValue({ ok: false, reason: "Could not upload the photo: too small" });
    const res = await photoPost(upload(new File([new Uint8Array([1])], "a.png", { type: "image/png" })));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("too small");
  });
});

describe("catalogue feed", () => {
  it("is public, is CSV, and quotes the live prices", async () => {
    asRole(null); // no login needed: Meta fetches it
    const res = await catalogGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv.split("\n")[0]).toBe("id,title,description,availability,condition,price,link,image_link,brand");
    expect(csv).toContain("155.00 EUR");
    expect(csv).toContain("50.00 EUR");
  });

  it("follows the settings: a service switched off is not in the feed", async () => {
    settings = { ...DEFAULT_SETTINGS, services: DEFAULT_SETTINGS.services.map((s) => (s.id === "girona" ? { ...s, enabled: false } : s)) };
    expect(await (await catalogGet()).text()).not.toContain("girona");
  });
});
