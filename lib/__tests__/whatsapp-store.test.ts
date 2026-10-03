import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { activityLog: db } }));

import {
  inboxRevision, lastOutboundTimes, loadThread, markSeen, recordInbound, recordOutbound, recordOutboundReaction,
  recordReaction, recordStatus,
} from "@/lib/whatsapp-inbox-store";

/**
 * The database side of the inbox, with the database replaced by a recorder.
 *
 * What matters here is what is written and when: a retried delivery must not be
 * stored twice, "seen" must not pile up a row per poll, and the change marker
 * the page polls on must move for every kind of change, including a message
 * that arrives late with an old timestamp.
 */

const PHONE = "+34635383712";
const at = (iso: string) => new Date(iso);

beforeEach(() => {
  vi.resetAllMocks();
  db.create.mockResolvedValue({});
  db.findFirst.mockResolvedValue(null);
  db.findMany.mockResolvedValue([]);
  db.count.mockResolvedValue(0);
});

describe("recording what Meta sends", () => {
  const message = { wamid: "w1", phone: PHONE, name: "Ana", at: at("2026-10-03T10:00:00Z"), type: "text", text: "Hello", mediaId: null, fileName: null, replyTo: "w0", choiceId: null };

  it("stores a new message with the time Meta stamped it", async () => {
    expect(await recordInbound(message)).toBe(true);
    const { data } = db.create.mock.calls[0][0];
    expect(data).toMatchObject({ action: "WA_MESSAGE", entity: "WhatsApp", entityId: PHONE, createdAt: message.at });
    expect(data.details).toMatchObject({ dir: "in", wamid: "w1", text: "Hello", replyTo: "w0", name: "Ana" });
  });

  it("stores a retried message only once", async () => {
    db.findFirst.mockResolvedValue({ id: "row1" });
    expect(await recordInbound(message)).toBe(false);
    expect(db.create).not.toHaveBeenCalled();
  });

  it("treats a failing duplicate check as 'not seen yet', so a message is never dropped", async () => {
    db.findFirst.mockRejectedValue(new Error("db hiccup"));
    expect(await recordInbound(message)).toBe(true);
    expect(db.create).toHaveBeenCalledTimes(1);
  });

  it("lets a failing write surface, so the webhook answers 500 and Meta retries", async () => {
    db.create.mockRejectedValue(new Error("db down"));
    await expect(recordInbound(message)).rejects.toThrow("db down");
  });

  it("stores each distinct status once, but a later status for the same message is new", async () => {
    const s = { wamid: "o1", phone: PHONE, status: "delivered" as const, at: at("2026-10-03T10:01:00Z"), errorCode: null, errorText: null };
    expect(await recordStatus(s)).toBe(true);
    expect(db.findFirst.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([{ details: { path: ["status"], equals: "delivered" } }]));
    db.findFirst.mockResolvedValue({ id: "x" });
    expect(await recordStatus(s)).toBe(false);
  });

  it("stores a reaction once, keyed on Meta's id for the reaction", async () => {
    const r = { id: "r1", wamid: "o1", phone: PHONE, emoji: "👍", at: at("2026-10-03T10:02:00Z") };
    expect(await recordReaction(r)).toBe(true);
    expect(db.findFirst.mock.calls[0][0].where.AND[0]).toEqual({ details: { path: ["id"], equals: "r1" } });
    expect(db.create.mock.calls[0][0].data.details).toMatchObject({ wamid: "o1", emoji: "👍", dir: "in" });
    db.findFirst.mockResolvedValue({ id: "x" });
    expect(await recordReaction(r)).toBe(false);
  });
});

describe("recording what the office sends", () => {
  it("stores text with who sent it and what it answered", async () => {
    await recordOutbound({ phone: PHONE, wamid: "o1", text: "On our way", by: "Sam", replyTo: "w1" });
    expect(db.create.mock.calls[0][0].data.details).toMatchObject({ dir: "out", wamid: "o1", text: "On our way", by: "Sam", type: "text", replyTo: "w1", mediaId: null });
  });

  it("stores a file with its id and name", async () => {
    await recordOutbound({ phone: PHONE, wamid: "o2", text: "[document] v.pdf", by: "Sam", type: "document", mediaId: "M1", fileName: "v.pdf" });
    expect(db.create.mock.calls[0][0].data.details).toMatchObject({ type: "document", mediaId: "M1", fileName: "v.pdf" });
  });

  it("stores the office's reaction as the office's", async () => {
    await recordOutboundReaction({ phone: PHONE, wamid: "w1", emoji: "👍" });
    expect(db.create.mock.calls[0][0].data).toMatchObject({ action: "WA_REACTION", entityId: PHONE });
    expect(db.create.mock.calls[0][0].data.details).toMatchObject({ wamid: "w1", emoji: "👍", dir: "out" });
  });
});

describe("markSeen", () => {
  const inbound = { createdAt: at("2026-10-03T10:00:00Z"), details: { wamid: "w9" } };

  it("writes one row and returns the latest message's id when something is unread", async () => {
    db.findFirst.mockResolvedValueOnce(inbound).mockResolvedValueOnce(null);
    expect(await markSeen(PHONE)).toBe("w9");
    expect(db.create).toHaveBeenCalledTimes(1);
    expect(db.create.mock.calls[0][0].data).toMatchObject({ action: "WA_SEEN", entityId: PHONE });
  });

  it("writes nothing when the chat was already seen since the last message", async () => {
    db.findFirst.mockResolvedValueOnce(inbound).mockResolvedValueOnce({ createdAt: at("2026-10-03T10:00:01Z") });
    expect(await markSeen(PHONE)).toBeNull();
    expect(db.create).not.toHaveBeenCalled();
  });

  it("writes again once a newer message has arrived since the last 'seen'", async () => {
    db.findFirst.mockResolvedValueOnce(inbound).mockResolvedValueOnce({ createdAt: at("2026-10-03T09:00:00Z") });
    expect(await markSeen(PHONE)).toBe("w9");
  });

  it("writes nothing for a customer who has never written", async () => {
    db.findFirst.mockResolvedValue(null);
    expect(await markSeen(PHONE)).toBeNull();
    expect(db.create).not.toHaveBeenCalled();
  });
});

describe("inboxRevision, the marker the page polls on", () => {
  it("is '0' for an empty inbox", async () => {
    expect(await inboxRevision()).toBe("0");
  });

  it("moves when a row is added even if the newest timestamp does not", async () => {
    // A late message: Meta stamped it before rows already stored.
    db.findFirst.mockResolvedValue({ createdAt: at("2026-10-03T12:00:00Z") });
    db.count.mockResolvedValue(10);
    const before = await inboxRevision();
    db.count.mockResolvedValue(11);
    const after = await inboxRevision();
    expect(after).not.toBe(before);
  });

  it("stays the same when nothing happened", async () => {
    db.findFirst.mockResolvedValue({ createdAt: at("2026-10-03T12:00:00Z") });
    db.count.mockResolvedValue(10);
    expect(await inboxRevision()).toBe(await inboxRevision());
  });

  it("can be asked about one chat only", async () => {
    await inboxRevision(PHONE);
    expect(db.count.mock.calls[0][0].where).toEqual({ entity: "WhatsApp", entityId: PHONE });
    expect(db.findFirst.mock.calls[0][0].where).toEqual({ entity: "WhatsApp", entityId: PHONE });
  });
});

describe("lastOutboundTimes", () => {
  it("returns when we last wrote and when we last sent an automatic reply", async () => {
    db.findFirst.mockResolvedValueOnce({ createdAt: at("2026-10-03T10:00:00Z") }).mockResolvedValueOnce({ createdAt: at("2026-10-03T08:00:00Z") });
    expect(await lastOutboundTimes(PHONE)).toEqual({ lastOutboundAt: at("2026-10-03T10:00:00Z"), lastAutoAt: at("2026-10-03T08:00:00Z") });
    const autoQuery = db.findFirst.mock.calls[1][0].where.AND;
    expect(autoQuery).toEqual(expect.arrayContaining([{ details: { path: ["by"], equals: "Auto-reply" } }]));
  });

  it("returns nulls for a customer we have never written to", async () => {
    expect(await lastOutboundTimes(PHONE)).toEqual({ lastOutboundAt: null, lastAutoAt: null });
  });
});

describe("loadThread", () => {
  it("builds the chat with the window and the latest customer message", async () => {
    const now = Date.now();
    db.findMany.mockResolvedValue([
      { action: "WA_MESSAGE", entityId: PHONE, createdAt: new Date(now - 3_600_000), details: { dir: "in", wamid: "w1", text: "hi", type: "text" } },
      { action: "WA_MESSAGE", entityId: PHONE, createdAt: new Date(now - 1_800_000), details: { dir: "out", wamid: "o1", text: "hello", type: "text", by: "Sam" } },
    ]);
    const t = await loadThread(PHONE);
    expect(t.messages.map((m) => m.dir)).toEqual(["in", "out"]);
    expect(t.canReplyFreely).toBe(true);
    expect(t.latestInboundId).toBe("w1");
    expect(new Date(t.windowEndsAt!).getTime()).toBe(now - 3_600_000 + 24 * 3_600_000);
    expect(db.findMany.mock.calls[0][0].where.entityId).toBe(PHONE);
  });

  it("says no free reply is possible when the customer last wrote over 24 hours ago", async () => {
    db.findMany.mockResolvedValue([
      { action: "WA_MESSAGE", entityId: PHONE, createdAt: new Date(Date.now() - 30 * 3_600_000), details: { dir: "in", wamid: "w1", text: "hi", type: "text" } },
    ]);
    expect((await loadThread(PHONE)).canReplyFreely).toBe(false);
  });
});
