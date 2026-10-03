import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), bookings: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { activityLog: { create: db.create, findFirst: db.findFirst, findMany: db.findMany, count: db.count }, booking: { findMany: db.bookings } } }));

import { loadConversations, loadSummary, markSeen, recordFlag } from "@/lib/whatsapp-inbox-store";
import { loadGroups, recordBroadcast, saveGroups, sentRecently } from "@/lib/whatsapp-groups-store";

/**
 * The database side of favorites, kept-as-unread, payment tags and groups.
 * The database is replaced by a recorder, so what is checked is exactly what
 * is asked for and written.
 */

const PHONE = "+34635383712";
const at = (iso: string) => new Date(iso);
const msg = (iso: string, details: Record<string, unknown> = {}) => ({ action: "WA_MESSAGE", entityId: PHONE, createdAt: at(iso), details: { dir: "in", wamid: "w1", text: "hi", type: "text", ...details } });

beforeEach(() => {
  vi.resetAllMocks();
  db.create.mockResolvedValue({});
  db.findFirst.mockResolvedValue(null);
  db.findMany.mockResolvedValue([]);
  db.bookings.mockResolvedValue([]);
});

describe("recordFlag", () => {
  it("writes the star or the keep-as-unread mark for one number", async () => {
    await recordFlag(PHONE, "favorite", true);
    expect(db.create.mock.calls[0][0].data).toMatchObject({ action: "WA_FLAG", entity: "WhatsApp", entityId: PHONE, details: { kind: "favorite", value: true } });
    await recordFlag(PHONE, "unread", true);
    expect(db.create.mock.calls[1][0].data.details).toEqual({ kind: "unread", value: true });
  });
});

describe("markSeen with a chat kept as unread", () => {
  it("clears a kept-unread mark even though no new message came, without a read receipt", async () => {
    const lastIn = { createdAt: at("2026-10-03T10:00:00Z"), details: { wamid: "w9" } };
    const seen = { createdAt: at("2026-10-03T10:05:00Z") };
    const kept = { createdAt: at("2026-10-03T10:10:00Z") };
    db.findFirst.mockResolvedValueOnce(lastIn).mockResolvedValueOnce(seen).mockResolvedValueOnce(kept);
    expect(await markSeen(PHONE)).toBeNull(); // no read receipt: the customer's message was already read
    expect(db.create).toHaveBeenCalledTimes(1);
    expect(db.create.mock.calls[0][0].data.action).toBe("WA_SEEN");
  });

  it("writes nothing when the kept mark is older than the last time the chat was opened", async () => {
    db.findFirst.mockResolvedValueOnce({ createdAt: at("2026-10-03T10:00:00Z"), details: { wamid: "w9" } })
      .mockResolvedValueOnce({ createdAt: at("2026-10-03T10:30:00Z") })
      .mockResolvedValueOnce({ createdAt: at("2026-10-03T10:10:00Z") });
    expect(await markSeen(PHONE)).toBeNull();
    expect(db.create).not.toHaveBeenCalled();
  });

  it("looks for the kept mark only where its value is true", async () => {
    await markSeen(PHONE);
    const flagQuery = db.findFirst.mock.calls[2][0].where;
    expect(flagQuery.action).toBe("WA_FLAG");
    expect(flagQuery.AND).toEqual(expect.arrayContaining([{ details: { path: ["value"], equals: true } }]));
  });

  it("still returns the message id for a read receipt when there is a new message", async () => {
    db.findFirst.mockResolvedValueOnce({ createdAt: at("2026-10-03T10:00:00Z"), details: { wamid: "w9" } }).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    expect(await markSeen(PHONE)).toBe("w9");
  });
});

describe("loadConversations with bookings", () => {
  const booking = (over: Record<string, unknown> = {}) => ({
    id: "b1", confirmationCode: "EBC-7", status: "CONFIRMED", paymentStatus: "PAID", paymentMethod: "CARD_LINK", depositAmount: null,
    balanceAmount: null, balancePaidAt: null, totalAmount: 90, pickupDatetime: new Date(Date.now() + 5 * 86400_000), guestName: "Ana Smith", guestPhone: PHONE, ...over,
  });

  beforeEach(() => { db.findMany.mockResolvedValue([msg(new Date(Date.now() - 3600_000).toISOString())]); });

  it("attaches the booking and its payment tag to the matching customer", async () => {
    db.bookings.mockResolvedValue([booking()]);
    const [c] = await loadConversations();
    expect(c.booking).toMatchObject({ code: "EBC-7", tag: "paid", label: "Paid in full", name: "Ana Smith" });
  });

  it("tags a deposit booking, and a pending one", async () => {
    db.bookings.mockResolvedValue([booking({ depositAmount: 27, balanceAmount: 63 })]);
    expect((await loadConversations())[0].booking).toMatchObject({ tag: "deposit", label: "30% paid" });
    db.bookings.mockResolvedValue([booking({ paymentStatus: "PENDING", status: "PENDING" })]);
    expect((await loadConversations())[0].booking?.tag).toBe("pending");
  });

  it("finds a booking whose number was saved without its plus sign", async () => {
    db.bookings.mockResolvedValue([booking({ guestPhone: "34635383712" })]);
    expect((await loadConversations())[0].booking?.code).toBe("EBC-7");
  });

  it("asks for the number written every way, in one query for all customers", async () => {
    await loadConversations();
    expect(db.bookings).toHaveBeenCalledTimes(1);
    expect(db.bookings.mock.calls[0][0].where.guestPhone.in).toEqual([PHONE, "34635383712", "0034635383712"]);
    expect(db.bookings.mock.calls[0][0].where.isDeleted).toBe(false);
  });

  it("leaves a customer with no booking untagged, and does not ask at all for an empty inbox", async () => {
    expect((await loadConversations())[0].booking).toBeNull();
    db.bookings.mockClear();
    db.findMany.mockResolvedValue([]);
    expect(await loadConversations()).toEqual([]);
    expect(db.bookings).not.toHaveBeenCalled();
  });

  it("still shows the inbox when the bookings lookup fails", async () => {
    db.bookings.mockRejectedValue(new Error("db down"));
    const [c] = await loadConversations();
    expect(c.phone).toBe(PHONE);
    expect(c.booking).toBeNull();
  });

  it("the badge and the alert do not need bookings, so they do not ask", async () => {
    db.bookings.mockClear();
    await loadSummary();
    expect(db.bookings).not.toHaveBeenCalled();
  });
});

describe("groups storage", () => {
  it("is empty before anything is saved, and when the database fails", async () => {
    expect(await loadGroups()).toEqual([]);
    db.findFirst.mockRejectedValue(new Error("down"));
    expect(await loadGroups()).toEqual([]);
  });

  it("saves the cleaned list, with who saved it, and returns what was saved", async () => {
    const saved = await saveGroups([{ name: " VIP ", members: ["+34 612 345 678", "garbage"] }], "Sam");
    expect(saved).toEqual([{ id: "vip", name: "VIP", members: ["+34612345678"] }]);
    expect(db.create.mock.calls[0][0].data).toMatchObject({ action: "WA_GROUPS", entity: "WhatsAppGroups", adminName: "Sam", details: { groups: saved } });
  });

  it("reads back the newest saved list, cleaned again", async () => {
    db.findFirst.mockResolvedValue({ details: { groups: [{ id: "x", name: "A", members: ["+34612345678", "bad"] }] } });
    expect(await loadGroups()).toEqual([{ id: "x", name: "A", members: ["+34612345678"] }]);
    expect(db.findFirst.mock.calls[0][0].orderBy).toEqual({ createdAt: "desc" });
  });

  it("recognises the same text sent to the same group a moment ago, by its fingerprint and not by storing it", async () => {
    db.findFirst.mockResolvedValue({ id: "row" });
    expect(await sentRecently("vip", "Hello everyone")).toBe(true);
    const q = db.findFirst.mock.calls[0][0].where;
    expect(q).toMatchObject({ action: "WA_BROADCAST", entityId: "vip" });
    expect(q.details.equals).toMatch(/^[0-9a-f]{24}$/);
    expect(q.details.equals).not.toContain("Hello");
    // The fingerprint ignores stray spaces around the text.
    await sentRecently("vip", "  Hello everyone  ");
    expect(db.findFirst.mock.calls[1][0].where.details.equals).toBe(q.details.equals);
    expect(q.createdAt.gte).toBeInstanceOf(Date);
  });

  it("treats a failing lookup as not sent recently, and a missing row as not sent", async () => {
    db.findFirst.mockResolvedValue(null);
    expect(await sentRecently("vip", "x")).toBe(false);
    db.findFirst.mockRejectedValue(new Error("down"));
    expect(await sentRecently("vip", "x")).toBe(false);
  });

  it("records a broadcast with a fingerprint, and never fails the send if it cannot", async () => {
    await recordBroadcast("vip", "Hello", "Sam", 3);
    expect(db.create.mock.calls[0][0].data).toMatchObject({ action: "WA_BROADCAST", entityId: "vip", adminName: "Sam", details: { sent: 3 } });
    expect(JSON.stringify(db.create.mock.calls[0][0].data)).not.toContain("Hello");
    db.create.mockRejectedValue(new Error("down"));
    await expect(recordBroadcast("vip", "Hello", "Sam", 3)).resolves.toBeUndefined();
  });
});
