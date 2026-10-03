import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_SETTINGS, type WhatsAppSettings } from "@/lib/whatsapp-settings";
import type { Conversation } from "@/lib/whatsapp-inbox";

/**
 * The routes behind favorites, groups, template approval and the follow-up
 * cron, and the follow-up run itself. Database and WhatsApp are replaced; what
 * is checked is who may call, what is refused, what is sent, and what is
 * recorded afterwards.
 */

const m = vi.hoisted(() => ({
  session: vi.fn(),
  recordFlag: vi.fn(), loadConversations: vi.fn(), lastOutboundTimes: vi.fn(), recordOutbound: vi.fn(),
  loadGroups: vi.fn(), saveGroups: vi.fn(), sentRecently: vi.fn(), recordBroadcast: vi.fn(),
  listTemplates: vi.fn(), createTemplate: vi.fn(), sendText: vi.fn(),
  loadSettings: vi.fn(), prices: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/whatsapp-inbox-store", () => ({
  recordFlag: m.recordFlag, loadConversations: m.loadConversations, lastOutboundTimes: m.lastOutboundTimes, recordOutbound: m.recordOutbound,
  inboxRevision: vi.fn(), loadThread: vi.fn(), markSeen: vi.fn(), recordOutboundReaction: vi.fn(),
}));
vi.mock("@/lib/whatsapp-groups-store", () => ({ loadGroups: m.loadGroups, saveGroups: m.saveGroups, sentRecently: m.sentRecently, recordBroadcast: m.recordBroadcast }));
vi.mock("@/lib/whatsapp", () => ({
  listWhatsAppTemplates: m.listTemplates, createWhatsAppTemplate: m.createTemplate, sendWhatsAppTextResult: m.sendText,
  markWhatsAppRead: vi.fn(), sendWhatsAppInteractive: vi.fn(), sendWhatsAppReaction: vi.fn(),
}));
vi.mock("@/lib/whatsapp-settings-store", () => ({ loadSettings: m.loadSettings }));
vi.mock("@/lib/destination-pricing", () => ({ getDestinationPrices: m.prices }));
vi.mock("@/lib/prisma", () => ({ prisma: { booking: { findFirst: vi.fn() } } }));

import { PATCH as flagPatch } from "@/app/api/admin/whatsapp/[phone]/route";
import { GET as groupsGet, PUT as groupsPut } from "@/app/api/admin/whatsapp/groups/route";
import { POST as groupSend } from "@/app/api/admin/whatsapp/groups/[id]/send/route";
import { GET as templatesGet, POST as templatesPost } from "@/app/api/admin/whatsapp/templates/route";
import { GET as cronGet, POST as cronPost } from "@/app/api/cron/whatsapp-followup/route";
import { runFollowUp, MAX_PER_RUN } from "@/lib/whatsapp-followup";
import { TEMPLATE_DEFS } from "@/lib/whatsapp-template-defs";

const asRole = (role: string | null) => m.session.mockResolvedValue(role ? { user: { role, name: "Sam" } } : null);
const req = (url: string, init?: RequestInit) => new NextRequest(`https://www.elitebcn.info${url}`, init as ConstructorParameters<typeof NextRequest>[1]);
const json = (body: unknown, method = "POST") => req("/x", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ctx = (phone = "%2B34635383712") => ({ params: Promise.resolve({ phone }) });
const gctx = (id = "friday") => ({ params: Promise.resolve({ id }) });

const NOW = new Date("2026-10-14T10:00:00Z");
const conv = (over: Partial<Conversation> = {}): Conversation => ({
  phone: "+34635383712", name: "Ana", lastText: "how much to sitges", lastType: "text", lastAt: new Date(NOW.getTime() - 20 * 60_000).toISOString(), lastDir: "in",
  lastStatus: null, unread: 1, favorite: false, markedUnread: false, booking: null, lastInText: "how much to sitges", lastInAt: new Date(NOW.getTime() - 20 * 60_000).toISOString(),
  windowEndsAt: new Date(NOW.getTime() + 23 * 3600_000).toISOString(), windowOpen: true, ...over,
});

let settings: WhatsAppSettings;

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  asRole("ADMIN");
  settings = { ...DEFAULT_SETTINGS, unanswered: { ...DEFAULT_SETTINGS.unanswered, enabled: true, minutes: 10 } };
  m.loadSettings.mockImplementation(async () => settings);
  m.prices.mockImplementation(async (z: string) => ({ sitges: { economy: 80 }, barcelona_city: { economy: 50 } } as Record<string, { economy: number }>)[z] ?? null);
  m.loadConversations.mockResolvedValue([conv()]);
  m.lastOutboundTimes.mockResolvedValue({ lastOutboundAt: null, lastAutoAt: null });
  m.sendText.mockResolvedValue({ outcome: "sent", id: "wamid.OUT" });
  m.sentRecently.mockResolvedValue(false);
  m.recordOutbound.mockResolvedValue(undefined);
  m.recordBroadcast.mockResolvedValue(undefined);
  m.loadGroups.mockResolvedValue([{ id: "friday", name: "Friday arrivals", members: ["+34635383712", "+34600000002", "+34600000003"] }]);
  m.saveGroups.mockImplementation(async (g: unknown) => g);
});
afterEach(() => vi.unstubAllEnvs());

// ─── Star and keep as unread ─────────────────────────────────────────────────

describe("PATCH a conversation", () => {
  it("is for admins only", async () => {
    for (const role of [null, "DRIVER", "PARTNER", "CUSTOMER"]) {
      asRole(role);
      expect((await flagPatch(json({ favorite: true }, "PATCH"), ctx())).status).toBe(401);
    }
    expect(m.recordFlag).not.toHaveBeenCalled();
  });

  it("stars and unstars", async () => {
    expect((await flagPatch(json({ favorite: true }, "PATCH"), ctx())).status).toBe(200);
    expect(m.recordFlag).toHaveBeenLastCalledWith("+34635383712", "favorite", true);
    await flagPatch(json({ favorite: false }, "PATCH"), ctx());
    expect(m.recordFlag).toHaveBeenLastCalledWith("+34635383712", "favorite", false);
  });

  it("keeps a chat as unread, and records nothing for 'unread: false' because opening the chat is what clears it", async () => {
    await flagPatch(json({ unread: true }, "PATCH"), ctx());
    expect(m.recordFlag).toHaveBeenCalledWith("+34635383712", "unread", true);
    m.recordFlag.mockClear();
    expect((await flagPatch(json({ unread: false }, "PATCH"), ctx())).status).toBe(200);
    expect(m.recordFlag).not.toHaveBeenCalled();
  });

  it("refuses an empty change, nonsense and a bad number", async () => {
    for (const body of [{}, { favorite: "yes" }, { unread: 1 }, null]) expect((await flagPatch(json(body, "PATCH"), ctx())).status).toBe(422);
    expect((await flagPatch(json({ favorite: true }, "PATCH"), ctx("abc"))).status).toBe(422);
    expect(m.recordFlag).not.toHaveBeenCalled();
  });
});

// ─── Groups ──────────────────────────────────────────────────────────────────

describe("groups", () => {
  it("are for admins only", async () => {
    for (const role of [null, "DRIVER", "CUSTOMER"]) {
      asRole(role);
      expect((await groupsGet()).status).toBe(401);
      expect((await groupsPut(json({ groups: [] }, "PUT"))).status).toBe(401);
      expect((await groupSend(json({ text: "hi" }), gctx())).status).toBe(401);
    }
    expect(m.sendText).not.toHaveBeenCalled();
    expect(m.saveGroups).not.toHaveBeenCalled();
  });

  it("lists and saves, saying who saved", async () => {
    expect((await (await groupsGet()).json()).groups).toHaveLength(1);
    const res = await groupsPut(json({ groups: [{ name: "VIP", members: [] }] }, "PUT"));
    expect(res.status).toBe(200);
    expect(m.saveGroups).toHaveBeenCalledWith([{ name: "VIP", members: [] }], "Sam");
    expect((await groupsPut(json({ nope: 1 }, "PUT"))).status).toBe(422);
    expect((await groupsPut(json({ groups: "x" }, "PUT"))).status).toBe(422);
  });
});

describe("writing to a group", () => {
  const send = (text: unknown = "Your driver is on the way", id = "friday") => groupSend(json({ text }), gctx(id));

  it("sends privately to each member who can receive it, and skips the rest with the reason", async () => {
    m.loadConversations.mockResolvedValue([
      conv({ phone: "+34635383712", name: "Ana", windowOpen: true }),
      conv({ phone: "+34600000002", name: "Luis", windowOpen: false }),
    ]);
    const res = await send();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sent).toBe(1);
    expect(m.sendText).toHaveBeenCalledTimes(1);
    expect(m.sendText).toHaveBeenCalledWith("+34635383712", "Your driver is on the way");
    expect(body.skipped).toEqual([
      { phone: "+34600000002", reason: "last wrote more than 24 hours ago" },
      { phone: "+34600000003", reason: "has not written to us" },
    ]);
  });

  it("records each message in that person's own chat, as sent for the group", async () => {
    await send();
    expect(m.recordOutbound).toHaveBeenCalledWith({ phone: "+34635383712", wamid: "wamid.OUT", text: "Your driver is on the way", by: "Group: Friday arrivals" });
    expect(m.recordBroadcast).toHaveBeenCalledWith("friday", "Your driver is on the way", "Sam", 1);
  });

  it("does not record a message WhatsApp refused, and reports it", async () => {
    m.sendText.mockResolvedValue({ outcome: "failed", reason: "token expired" });
    const body = await (await send()).json();
    expect(body.sent).toBe(0);
    expect(m.recordOutbound).not.toHaveBeenCalled();
    expect(body.skipped.some((s: { reason: string }) => s.reason === "token expired")).toBe(true);
  });

  it("refuses when nobody in the group can be written to, naming why", async () => {
    m.loadConversations.mockResolvedValue([conv({ windowOpen: false })]);
    const res = await send();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/last 24 hours/);
    expect(m.sendText).not.toHaveBeenCalled();
  });

  it("refuses the same text sent twice in a few minutes", async () => {
    m.sentRecently.mockResolvedValue(true);
    expect((await send()).status).toBe(409);
    expect(m.sendText).not.toHaveBeenCalled();
  });

  it("refuses an empty message, an unknown group and an empty group", async () => {
    expect((await send("   ")).status).toBe(422);
    expect((await send(5)).status).toBe(422);
    expect((await send("hi", "nope")).status).toBe(404);
    m.loadGroups.mockResolvedValue([{ id: "friday", name: "Empty", members: [] }]);
    expect((await send()).status).toBe(422);
    expect(m.sendText).not.toHaveBeenCalled();
  });

  it("never reaches someone outside the group, however many chats exist", async () => {
    m.loadConversations.mockResolvedValue([
      conv({ phone: "+34635383712" }), conv({ phone: "+34699999991" }), conv({ phone: "+34699999992" }),
    ]);
    await send();
    expect(m.sendText.mock.calls.map((c) => c[0])).toEqual(["+34635383712"]);
  });
});

// ─── Templates in Meta ───────────────────────────────────────────────────────

describe("message templates", () => {
  const meta = (rows: { name: string; status: string; language?: string; rejectedReason?: string | null }[]) =>
    ({ ok: true, templates: rows.map((r) => ({ category: "UTILITY", language: "en", rejectedReason: null, ...r })) });

  it("are for admins only", async () => {
    asRole("DRIVER");
    expect((await templatesGet()).status).toBe(401);
    expect((await templatesPost()).status).toBe(401);
    expect(m.createTemplate).not.toHaveBeenCalled();
  });

  it("shows each template the site needs with where Meta has it", async () => {
    m.listTemplates.mockResolvedValue(meta([{ name: "booking_confirmation", status: "APPROVED" }, { name: "driver_assigned", status: "PENDING" }, { name: "flight_delayed", status: "REJECTED", rejectedReason: "INVALID_FORMAT" }, { name: "unrelated", status: "APPROVED" }]));
    const rows = (await (await templatesGet()).json()).templates as { name: string; status: string; problem: string | null }[];
    expect(rows.map((r) => r.name)).toEqual(TEMPLATE_DEFS.map((t) => t.name));
    expect(rows.find((r) => r.name === "booking_confirmation")!.status).toBe("APPROVED");
    expect(rows.find((r) => r.name === "driver_assigned")!.status).toBe("PENDING");
    expect(rows.find((r) => r.name === "flight_delayed")).toMatchObject({ status: "REJECTED", problem: "INVALID_FORMAT" });
    expect(rows.find((r) => r.name === "pickup_soon")!.status).toBe("MISSING");
  });

  it("uses the English version when the same name exists in other languages", async () => {
    m.listTemplates.mockResolvedValue(meta([{ name: "driver_assigned", status: "REJECTED", language: "es" }, { name: "driver_assigned", status: "APPROVED", language: "en_US" }]));
    const rows = (await (await templatesGet()).json()).templates as { name: string; status: string }[];
    expect(rows.find((r) => r.name === "driver_assigned")!.status).toBe("APPROVED");
  });

  it("explains when Meta cannot be reached", async () => {
    m.listTemplates.mockResolvedValue({ ok: false, reason: "token expired" });
    const res = await templatesGet();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("token expired");
  });

  it("submits only the templates that do not exist, leaving approved, waiting and refused ones alone", async () => {
    m.listTemplates
      .mockResolvedValueOnce(meta([{ name: "booking_confirmation", status: "APPROVED" }, { name: "driver_assigned", status: "PENDING" }, { name: "flight_delayed", status: "REJECTED" }]))
      .mockResolvedValue(meta([{ name: "booking_confirmation", status: "APPROVED" }, { name: "driver_assigned", status: "PENDING" }, { name: "flight_delayed", status: "REJECTED" }, { name: "pickup_soon", status: "PENDING" }, { name: "driver_flight_delay", status: "PENDING" }]));
    m.createTemplate.mockResolvedValue({ ok: true, status: "PENDING" });
    const body = await (await templatesPost()).json();
    expect(m.createTemplate.mock.calls.map((c) => c[0].name).sort()).toEqual(["driver_flight_delay", "pickup_soon"]);
    expect(body.submitted).toEqual([{ name: "pickup_soon", ok: true, detail: "PENDING" }, { name: "driver_flight_delay", ok: true, detail: "PENDING" }]);
  });

  it("sends Meta exactly the wording, category, language and one example per slot", async () => {
    m.listTemplates.mockResolvedValue(meta([]));
    m.createTemplate.mockResolvedValue({ ok: true, status: "PENDING" });
    await templatesPost();
    for (const call of m.createTemplate.mock.calls) {
      const def = TEMPLATE_DEFS.find((t) => t.name === call[0].name)!;
      expect(call[0]).toMatchObject({ body: def.body, category: "UTILITY", language: "en", examples: def.examples });
    }
    expect(m.createTemplate).toHaveBeenCalledTimes(TEMPLATE_DEFS.length);
  });

  it("reports a template Meta refused to take, and carries on with the rest", async () => {
    m.listTemplates.mockResolvedValue(meta([]));
    m.createTemplate.mockResolvedValueOnce({ ok: false, reason: "Invalid parameter" }).mockResolvedValue({ ok: true, status: "PENDING" });
    const body = await (await templatesPost()).json();
    expect(body.submitted[0]).toEqual({ name: TEMPLATE_DEFS[0].name, ok: false, detail: "Invalid parameter" });
    expect(body.submitted.slice(1).every((s: { ok: boolean }) => s.ok)).toBe(true);
  });

  it("submits nothing when every template already exists", async () => {
    m.listTemplates.mockResolvedValue(meta(TEMPLATE_DEFS.map((t) => ({ name: t.name, status: "APPROVED" }))));
    expect((await (await templatesPost()).json()).submitted).toEqual([]);
    expect(m.createTemplate).not.toHaveBeenCalled();
  });
});

// ─── The follow-up when nobody replies ───────────────────────────────────────

describe("runFollowUp", () => {
  it("does nothing while it is switched off", async () => {
    settings = { ...settings, unanswered: { ...settings.unanswered, enabled: false } };
    expect(await runFollowUp(NOW)).toMatchObject({ enabled: false, sent: 0 });
    expect(m.loadConversations).not.toHaveBeenCalled();
    expect(m.sendText).not.toHaveBeenCalled();
  });

  it("answers a question it knows from the live price table, and records it as automatic", async () => {
    const r = await runFollowUp(NOW);
    expect(r).toMatchObject({ considered: 1, sent: 1 });
    const text = m.sendText.mock.calls[0][1] as string;
    expect(m.sendText.mock.calls[0][0]).toBe("+34635383712");
    expect(text).toContain("from €80");
    expect(m.recordOutbound).toHaveBeenCalledWith({ phone: "+34635383712", wamid: "wamid.OUT", text, by: "Auto-reply" });
  });

  it("uses the holding message for a question it does not know, or when the assistant is off", async () => {
    m.loadConversations.mockResolvedValue([conv({ lastInText: "tell me a joke" })]);
    await runFollowUp(NOW);
    expect(m.sendText.mock.calls[0][1]).toBe(settings.unanswered.text);
    m.sendText.mockClear();
    m.loadConversations.mockResolvedValue([conv()]);
    settings = { ...settings, unanswered: { ...settings.unanswered, assistant: false } };
    await runFollowUp(NOW);
    expect(m.sendText.mock.calls[0][1]).toBe(settings.unanswered.text);
  });

  it("answers a customer once in twelve hours however long nobody replies", async () => {
    m.lastOutboundTimes.mockResolvedValue({ lastOutboundAt: new Date(NOW.getTime() - 3 * 3600_000), lastAutoAt: new Date(NOW.getTime() - 3 * 3600_000) });
    expect(await runFollowUp(NOW)).toMatchObject({ sent: 0, skipped: 1 });
    m.lastOutboundTimes.mockResolvedValue({ lastOutboundAt: new Date(NOW.getTime() - 13 * 3600_000), lastAutoAt: new Date(NOW.getTime() - 13 * 3600_000) });
    expect(await runFollowUp(NOW)).toMatchObject({ sent: 1 });
  });

  it("leaves a customer someone has answered, one who has not waited long enough, and one outside the window", async () => {
    m.loadConversations.mockResolvedValue([
      conv({ phone: "+34600000001", lastDir: "out" }),
      conv({ phone: "+34600000002", lastAt: new Date(NOW.getTime() - 2 * 60_000).toISOString() }),
      conv({ phone: "+34600000003", windowOpen: false }),
    ]);
    expect(await runFollowUp(NOW)).toMatchObject({ considered: 0, sent: 0 });
    expect(m.sendText).not.toHaveBeenCalled();
  });

  it("does not record an answer WhatsApp refused", async () => {
    m.sendText.mockResolvedValue({ outcome: "failed", reason: "no" });
    expect(await runFollowUp(NOW)).toMatchObject({ sent: 0, skipped: 1 });
    expect(m.recordOutbound).not.toHaveBeenCalled();
  });

  it("does not try to read a photo", async () => {
    m.loadConversations.mockResolvedValue([conv({ lastType: "image", lastInText: "[image] how much to sitges" })]);
    await runFollowUp(NOW);
    expect(m.sendText.mock.calls[0][1]).toBe(settings.unanswered.text);
  });

  it("sends at most a fixed number in one run", async () => {
    m.loadConversations.mockResolvedValue(Array.from({ length: MAX_PER_RUN + 8 }, (_, i) => conv({ phone: `+3460000${String(i).padStart(4, "0")}` })));
    const r = await runFollowUp(NOW);
    expect(r.sent).toBe(MAX_PER_RUN);
    expect(m.sendText).toHaveBeenCalledTimes(MAX_PER_RUN);
  });
});

describe("the follow-up cron route", () => {
  const call = (handler: typeof cronGet, auth?: string) => handler(req("/api/cron/whatsapp-followup", { headers: auth ? { authorization: auth } : {} }));

  it("refuses a call without the secret, with the wrong one, or when no secret is set", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await call(cronGet)).status).toBe(401);
    expect((await call(cronGet, "Bearer wrong")).status).toBe(401);
    expect((await call(cronPost, "Bearer wrong")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await call(cronGet, "Bearer ")).status).toBe(401);
    expect((await call(cronGet, "Bearer elite-cron-secret")).status).toBe(401);
    expect(m.sendText).not.toHaveBeenCalled();
  });

  it("runs with the secret, by GET (how Vercel calls it) or POST", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await call(cronGet, "Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ enabled: true });
    expect((await call(cronPost, "Bearer s3cret")).status).toBe(200);
  });
});
