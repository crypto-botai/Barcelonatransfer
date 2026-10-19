import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const db = vi.hoisted(() => ({
  messages: [] as Row[],
  reads: [] as Row[],
  atts: [] as Row[],
  seq: 0,
  notify: vi.fn(),
  booking: null as Row | null,
}));

/** A tiny where-evaluator for the shapes lib/chat.ts uses: AND, OR, equality, not, gt, lt, in. */
function match(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (k === "AND") return (v as Row[]).every((w) => match(row, w));
    if (k === "OR") return (v as Row[]).some((w) => match(row, w));
    const cur = row[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const o = v as Record<string, unknown>;
      if ("not" in o) return cur !== o.not;
      if ("in" in o) return (o.in as unknown[]).includes(cur);
      if ("gt" in o || "lt" in o) {
        const t = (cur as Date).getTime();
        return (!("gt" in o) || t > (o.gt as Date).getTime()) && (!("lt" in o) || t < (o.lt as Date).getTime());
      }
      return true;
    }
    return cur === v;
  });
}

vi.mock("@/lib/notifications/service", () => ({ notify: db.notify }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tripMessage: {
      findMany: async ({ where, orderBy, take }: { where: Row; orderBy?: { createdAt: "asc" | "desc" }; take?: number }) => {
        const rows = db.messages.filter((m) => match(m, where)).sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
        if (orderBy?.createdAt === "desc") rows.reverse();
        return rows.slice(0, take ?? 1000);
      },
      findFirst: async ({ where }: { where: Row }) => db.messages.find((m) => match(m, where)) ?? null,
      count: async ({ where }: { where: Row }) => db.messages.filter((m) => match(m, where)).length,
      create: async ({ data }: { data: Row }) => {
        if (data.clientId && db.messages.some((m) => m.bookingId === data.bookingId && m.sender === data.sender && m.clientId === data.clientId)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const row = { id: `m${++db.seq}`, createdAt: new Date(Date.now() + db.seq), ...data };
        db.messages.push(row);
        return row;
      },
    },
    tripChatRead: {
      findUnique: async ({ where }: { where: { bookingId_party: { bookingId: string; party: string } } }) =>
        db.reads.find((r) => r.bookingId === where.bookingId_party.bookingId && r.party === where.bookingId_party.party) ?? null,
      upsert: async ({ where, create, update }: { where: { bookingId_party: { bookingId: string; party: string } }; create: Row; update: Row }) => {
        const cur = db.reads.find((r) => r.bookingId === where.bookingId_party.bookingId && r.party === where.bookingId_party.party);
        if (cur) Object.assign(cur, update);
        else db.reads.push(create);
      },
      findMany: async ({ where }: { where: { bookingId: { in: string[] }; party: string } }) => db.reads.filter((r) => where.bookingId.in.includes(r.bookingId as string) && r.party === where.party),
    },
    tripChatAttachment: {
      create: async ({ data }: { data: Row }) => { const row = { id: `a${++db.seq}`, ...data }; db.atts.push(row); return row; },
      findFirst: async ({ where }: { where: Row }) => db.atts.find((a) => match(a, where)) ?? null,
    },
  },
}));

import {
  ATTACHMENT_MAX_BYTES, CHAT_GRACE_MS, ChatRuleError, chatClosedReason, listChat, markChatRead, readAttachment, saveAttachment, sendChat, sniffImage, unreadByBooking, unreadCount,
  type ChatContext,
} from "@/lib/chat";

const ride = (over: Partial<ChatContext> = {}): ChatContext => ({
  id: "b1", status: "DRIVER_ASSIGNED", rideEndedAt: null, updatedAt: new Date(), userId: "u-cust", customerName: "Ana Customer", driverUserId: "u-drv", driverName: "Dani Driver", ...over,
});
const texts = async (party: "CUSTOMER" | "DRIVER" | "ADMIN") => (await listChat("b1", party)).messages.map((m) => m.text);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]).toString("base64");

beforeEach(() => {
  db.messages = []; db.reads = []; db.atts = []; db.seq = 0;
  db.notify.mockReset();
  db.notify.mockResolvedValue(undefined);
});

describe("shared ride chat", () => {
  it("a customer's message reaches the driver and the office, and the driver's reply reaches the customer", async () => {
    await sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", text: "I am at door 3" });
    await sendChat(ride(), "DRIVER", { clientId: "d-0000001", text: "On my way" });
    expect(await texts("DRIVER")).toEqual(["I am at door 3", "On my way"]);
    expect(await texts("CUSTOMER")).toEqual(["I am at door 3", "On my way"]);
    expect(await texts("ADMIN")).toEqual(["I am at door 3", "On my way"]);
  });

  it("marks which messages are the reader's own", async () => {
    await sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", text: "hi" });
    expect((await listChat("b1", "CUSTOMER")).messages[0]!.mine).toBe(true);
    expect((await listChat("b1", "DRIVER")).messages[0]!.mine).toBe(false);
  });

  it("an office message to everyone is seen by both, and shows as the office", async () => {
    await sendChat(ride(), "ADMIN", { clientId: "o-0000001", text: "Flight landed early", scope: "SHARED" });
    const c = (await listChat("b1", "CUSTOMER")).messages[0]!;
    expect(c).toMatchObject({ text: "Flight landed early", from: "office", name: "Elite BCN", private: false });
    expect(await texts("DRIVER")).toEqual(["Flight landed early"]);
  });
});

describe("private office messages", () => {
  it("an office message to the customer is invisible to the driver, and the other way round", async () => {
    await sendChat(ride(), "ADMIN", { clientId: "o-0000001", text: "secret for customer", scope: "PRIVATE", to: "CUSTOMER" });
    await sendChat(ride(), "ADMIN", { clientId: "o-0000002", text: "secret for driver", scope: "PRIVATE", to: "DRIVER" });
    expect(await texts("CUSTOMER")).toEqual(["secret for customer"]);
    expect(await texts("DRIVER")).toEqual(["secret for driver"]);
    expect((await listChat("b1", "CUSTOMER")).messages[0]!.private).toBe(true);
    expect(await texts("ADMIN")).toEqual(["secret for customer", "secret for driver"]);
  });

  it("a private reply from the customer reaches only the office", async () => {
    await sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", text: "please call me", scope: "PRIVATE" });
    expect(await texts("ADMIN")).toEqual(["please call me"]);
    expect(await texts("DRIVER")).toEqual([]);
    expect(await texts("CUSTOMER")).toEqual(["please call me"]);
  });

  it("a private message does not count as unread for the other party", async () => {
    await sendChat(ride(), "ADMIN", { clientId: "o-0000001", text: "private to customer", scope: "PRIVATE", to: "CUSTOMER" });
    expect(await unreadCount("b1", "CUSTOMER")).toBe(1);
    expect(await unreadCount("b1", "DRIVER")).toBe(0);
    expect(await unreadByBooking(["b1"], "DRIVER")).toEqual({});
  });

  it("the notification never contains message text, and a private one looks the same as a shared one", async () => {
    await sendChat(ride(), "ADMIN", { clientId: "o-0000001", text: "TOP SECRET", scope: "PRIVATE", to: "CUSTOMER" });
    await sendChat(ride(), "ADMIN", { clientId: "o-0000002", text: "TOP SECRET too", scope: "SHARED" });
    const calls = db.notify.mock.calls.map((c) => c[0]);
    expect(JSON.stringify(calls)).not.toContain("SECRET");
    expect(calls.every((c) => c.event === "CHAT_MESSAGE" && c.channels.join() === "push")).toBe(true);
    // the private one went to the customer only; the shared one to both
    expect(calls.filter((c) => c.userId === "u-drv")).toHaveLength(1);
    expect(calls.filter((c) => c.userId === "u-cust")).toHaveLength(2);
    expect(Object.keys(calls[0].vars)).toEqual(["from"]);
  });

  it("only the office can address a private message to a person, and a person can only write privately to the office", async () => {
    await expect(sendChat(ride(), "ADMIN", { clientId: "o-0000001", text: "x", scope: "PRIVATE" })).rejects.toMatchObject({ code: "BAD_TARGET" });
    await expect(sendChat(ride({ driverUserId: null, driverName: null }), "ADMIN", { clientId: "o-0000001", text: "x", scope: "PRIVATE", to: "DRIVER" })).rejects.toMatchObject({ code: "BAD_TARGET" });
    // a driver asking for a private message to the customer is stored as a private message to the office instead
    await sendChat(ride(), "DRIVER", { clientId: "d-0000001", text: "hello", scope: "PRIVATE", to: "CUSTOMER" });
    expect(await texts("CUSTOMER")).toEqual([]);
    expect(await texts("ADMIN")).toEqual(["hello"]);
  });
});

describe("validation, duplicates and closing", () => {
  it("refuses empty and over-long messages", async () => {
    await expect(sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", text: "   " })).rejects.toMatchObject({ code: "EMPTY" });
    await expect(sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", text: "x".repeat(1001) })).rejects.toBeInstanceOf(ChatRuleError);
    expect(db.messages).toHaveLength(0);
  });

  it("strips control characters", async () => {
    const out = await sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", text: "hi\u0000 there\u0007" });
    expect(out.message.text).toBe("hi there");
  });

  it("sending the same clientId twice stores one message", async () => {
    const a = await sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", text: "once" });
    const b = await sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", text: "once" });
    expect(a.duplicate).toBe(false);
    expect(b).toMatchObject({ duplicate: true, message: { id: a.message.id } });
    expect(db.messages).toHaveLength(1);
    // and the other person is not notified twice
    expect(db.notify).toHaveBeenCalledTimes(1);
  });

  it("a race on the unique index returns the stored message instead of failing", async () => {
    const a = await sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", text: "once" });
    // force the "not found yet" path then the unique violation
    const orig = db.messages.slice();
    const spy = vi.spyOn(db.messages, "find");
    spy.mockReturnValueOnce(undefined);
    const again = await sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", text: "once" });
    expect(again.message.id).toBe(a.message.id);
    expect(db.messages).toHaveLength(orig.length);
    spy.mockRestore();
  });

  it("a pending ride has no chat yet; a ride closes for the apps a day after it ends, but never for the office", async () => {
    await expect(sendChat(ride({ status: "PENDING" }), "CUSTOMER", { clientId: "c-0000001", text: "hi" })).rejects.toMatchObject({ code: "CLOSED" });
    const ended = ride({ status: "COMPLETED", rideEndedAt: new Date(Date.now() - CHAT_GRACE_MS + 60_000) });
    await expect(sendChat(ended, "CUSTOMER", { clientId: "c-0000001", text: "thank you" })).resolves.toBeTruthy();
    const old = ride({ status: "COMPLETED", rideEndedAt: new Date(Date.now() - CHAT_GRACE_MS - 60_000) });
    expect(chatClosedReason(old)).toMatch(/closed/);
    await expect(sendChat(old, "DRIVER", { clientId: "d-0000001", text: "late" })).rejects.toMatchObject({ code: "CLOSED" });
    await expect(sendChat(old, "ADMIN", { clientId: "o-0000001", text: "office can still write", scope: "SHARED" })).resolves.toBeTruthy();
    // a completed conversation is still readable
    expect(await texts("CUSTOMER")).toContain("thank you");
  });
});

describe("unread and paging", () => {
  it("counts only other people's messages after the last read", async () => {
    await sendChat(ride(), "DRIVER", { clientId: "d-0000001", text: "one" });
    await sendChat(ride(), "DRIVER", { clientId: "d-0000002", text: "two" });
    await sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", text: "mine" });
    expect(await unreadCount("b1", "CUSTOMER")).toBe(2);
    await markChatRead("b1", "CUSTOMER", new Date(Date.now() + 1000));
    expect(await unreadCount("b1", "CUSTOMER")).toBe(0);
    await sendChat(ride(), "DRIVER", { clientId: "d-0000003", text: "three" });
    db.messages[db.messages.length - 1]!.createdAt = new Date(Date.now() + 5000);
    expect(await unreadCount("b1", "CUSTOMER")).toBe(1);
    expect(await unreadByBooking(["b1", "b2"], "CUSTOMER")).toEqual({ b1: 1 });
  });

  it("returns the newest page first-to-last, says when more exists, and pages back", async () => {
    for (let i = 1; i <= 5; i++) await sendChat(ride(), "CUSTOMER", { clientId: `c-000000${i}`, text: `m${i}` });
    const p1 = await listChat("b1", "CUSTOMER", { limit: 2 });
    expect(p1.messages.map((m) => m.text)).toEqual(["m4", "m5"]);
    expect(p1.hasMore).toBe(true);
    const p2 = await listChat("b1", "CUSTOMER", { limit: 2, before: p1.messages[0]!.createdAt });
    expect(p2.messages.map((m) => m.text)).toEqual(["m2", "m3"]);
    const news = await listChat("b1", "CUSTOMER", { after: p2.messages[1]!.createdAt });
    expect(news.messages.map((m) => m.text)).toEqual(["m4", "m5"]);
  });
});

describe("photos", () => {
  it("accepts a real JPEG and rejects other types, oversize files and junk", async () => {
    expect(sniffImage(Buffer.from(JPEG, "base64"))).toBe("image/jpeg");
    await expect(saveAttachment("b1", "CUSTOMER", Buffer.from("%PDF-1.4 fake").toString("base64"))).rejects.toMatchObject({ code: "BAD_ATTACHMENT" });
    await expect(saveAttachment("b1", "CUSTOMER", "not base64 !!")).rejects.toMatchObject({ code: "BAD_ATTACHMENT" });
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(ATTACHMENT_MAX_BYTES + 10)]).toString("base64");
    await expect(saveAttachment("b1", "CUSTOMER", big)).rejects.toMatchObject({ code: "BAD_ATTACHMENT" });
    // the sender's claimed type is ignored: an HTML file named .jpg is not an image
    await expect(saveAttachment("b1", "CUSTOMER", Buffer.from("<script>alert(1)</script>").toString("base64"))).rejects.toMatchObject({ code: "BAD_ATTACHMENT" });
  });

  it("only the uploader can attach a photo, and only to their own ride", async () => {
    const id = await saveAttachment("b1", "CUSTOMER", JPEG);
    await expect(sendChat(ride(), "DRIVER", { clientId: "d-0000001", attachmentId: id })).rejects.toMatchObject({ code: "BAD_ATTACHMENT" });
    await expect(sendChat(ride({ id: "b2" }), "CUSTOMER", { clientId: "c-0000009", attachmentId: id })).rejects.toMatchObject({ code: "BAD_ATTACHMENT" });
    const ok = await sendChat(ride(), "CUSTOMER", { clientId: "c-0000001", attachmentId: id });
    expect(ok.message.attachmentId).toBe(id);
  });

  it("a photo follows the privacy of its message", async () => {
    const id = await saveAttachment("b1", "ADMIN", JPEG);
    await sendChat(ride(), "ADMIN", { clientId: "o-0000001", attachmentId: id, scope: "PRIVATE", to: "CUSTOMER" });
    expect(await readAttachment("b1", id, "CUSTOMER")).toMatchObject({ mime: "image/jpeg" });
    expect(await readAttachment("b1", id, "ADMIN")).not.toBeNull();
    expect(await readAttachment("b1", id, "DRIVER")).toBeNull();
    // another ride's id never finds it
    expect(await readAttachment("b2", id, "ADMIN")).toBeNull();
  });

  it("an uploaded photo that is not attached yet can be read only by who uploaded it (and the office)", async () => {
    const id = await saveAttachment("b1", "CUSTOMER", JPEG);
    expect(await readAttachment("b1", id, "CUSTOMER")).not.toBeNull();
    expect(await readAttachment("b1", id, "DRIVER")).toBeNull();
    expect(await readAttachment("b1", id, "ADMIN")).not.toBeNull();
  });
});
