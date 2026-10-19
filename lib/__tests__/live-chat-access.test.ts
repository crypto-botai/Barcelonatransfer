import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  session: null as unknown,
  sent: vi.fn(),
  listed: vi.fn(),
  photo: vi.fn(),
  rideOwner: "u-cust",
  rideDriver: "d1",
}));

vi.mock("next-auth", () => ({ getServerSession: async () => m.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/api/v1/rides", async () => {
  const { notFound } = await import("@/lib/api/v1/errors");
  return { requireOwnedRide: async (_id: string, userId: string) => { if (userId !== m.rideOwner) throw notFound("We could not find that ride."); return {}; } };
});
vi.mock("@/lib/api/v1/driver-rides", async () => {
  const { notFound } = await import("@/lib/api/v1/errors");
  return {
    requireDriver: async (userId: string) => ({ id: userId === "u-drv" ? "d1" : "other" }),
    requireDriverRide: async (_id: string, driverId: string) => { if (driverId !== m.rideDriver) throw notFound("We could not find that ride."); return {}; },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: { tripChatRead: { findMany: async () => [{ party: "DRIVER", readAt: new Date("2026-10-19T10:00:00Z") }] } } }));
vi.mock("@/lib/api/v1/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/chat", async (orig) => {
  const real = await orig<typeof import("@/lib/chat")>();
  return {
    ...real,
    chatContext: async (id: string) => ({ id, status: "DRIVER_ASSIGNED", rideEndedAt: null, updatedAt: new Date(), userId: "u-cust", customerName: "Ana", driverUserId: "u-drv", driverName: "Dani" }),
    listChat: async (...a: unknown[]) => { m.listed(...a); return { messages: [], hasMore: false }; },
    unreadCount: async () => 0,
    sendChat: async (...a: unknown[]) => { m.sent(...a); return { message: { id: "m1", private: false }, duplicate: false }; },
    readAttachment: async (...a: unknown[]) => m.photo(...a),
  };
});

import { chatGetPhoto, chatSendMessage, chatThread, chatUnread } from "@/lib/api/v1/chat-routes";
import { GET as adminList } from "@/app/api/admin/chat/route";
import { GET as adminThreadGet, POST as adminSend } from "@/app/api/admin/chat/[id]/route";
import { GET as adminPhoto } from "@/app/api/admin/chat/[id]/photos/[photoId]/route";
import type { NextRequest } from "next/server";

const url = new URL("https://x.test/api/v1/rides/b1/chat");
const post = (body: unknown) => new Request(url, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

beforeEach(() => {
  m.session = null;
  m.sent.mockReset(); m.listed.mockReset(); m.photo.mockReset();
  m.rideOwner = "u-cust"; m.rideDriver = "d1";
});

describe("customer and driver access", () => {
  it("the customer of the ride can read and send", async () => {
    await expect(chatThread("CUSTOMER", "b1", "u-cust", url)).resolves.toMatchObject({ messages: [], closed: null, readAt: { peer: "2026-10-19T10:00:00.000Z", office: null } });
    const out = await chatSendMessage("CUSTOMER", "b1", "u-cust", post({ clientId: "client-123", text: "hi" }), "req1");
    expect(out.duplicate).toBe(false);
    expect(m.sent.mock.calls[0]![1]).toBe("CUSTOMER");
  });

  it("another customer gets the same not-found as a ride that does not exist, and nothing is read or sent", async () => {
    await expect(chatThread("CUSTOMER", "b1", "u-stranger", url)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(chatSendMessage("CUSTOMER", "b1", "u-stranger", post({ clientId: "client-123", text: "hi" }), "req1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.listed).not.toHaveBeenCalled();
    expect(m.sent).not.toHaveBeenCalled();
  });

  it("a driver not assigned to the ride is denied the same way", async () => {
    await expect(chatThread("DRIVER", "b1", "u-other-driver", url)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(chatSendMessage("DRIVER", "b1", "u-other-driver", post({ clientId: "client-123", text: "hi" }), "req1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.sent).not.toHaveBeenCalled();
    await expect(chatThread("DRIVER", "b1", "u-drv", url)).resolves.toBeTruthy();
  });

  it("rejects a malformed send before storing anything", async () => {
    await expect(chatSendMessage("CUSTOMER", "b1", "u-cust", post({ text: "no client id" }), "req1")).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(m.sent).not.toHaveBeenCalled();
  });

  it("a photo the person may not see is NOT_FOUND, and an unauthorised ride is checked before the photo", async () => {
    m.photo.mockResolvedValue(null);
    await expect(chatGetPhoto("DRIVER", "b1", "u-drv", "a1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    m.photo.mockClear();
    await expect(chatGetPhoto("CUSTOMER", "b1", "u-stranger", "a1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.photo).not.toHaveBeenCalled();
    m.photo.mockResolvedValue({ mime: "image/jpeg", data: new Uint8Array([1, 2, 3]) });
    await expect(chatGetPhoto("CUSTOMER", "b1", "u-cust", "a1")).resolves.toEqual({ mime: "image/jpeg", data: "AQID" });
  });

  it("the chat rate limits exist and are tighter for sending than reading", async () => {
    const { RATE_LIMITS } = await import("@/lib/api/v1/rate-limit");
    expect(RATE_LIMITS.chatSend.limit).toBeLessThan(RATE_LIMITS.chatRead.limit);
    void chatUnread;
  });
});

describe("admin chat routes are office-only", () => {
  const ctx = { params: Promise.resolve({ id: "b1" }) };
  const req = (body?: unknown) => new Request("https://x.test/api/admin/chat/b1", { method: body ? "POST" : "GET", body: body ? JSON.stringify(body) : undefined }) as unknown as NextRequest;

  it.each([
    ["anonymous", null],
    ["customer", { user: { id: "u-cust", role: "CUSTOMER" } }],
    ["driver", { user: { id: "u-drv", role: "DRIVER" } }],
    ["fleet partner", { user: { id: "p1", role: "PARTNER" } }],
  ])("%s gets 401 on every admin chat route", async (_who, session) => {
    m.session = session;
    expect((await adminList(req() as never)).status).toBe(401);
    expect((await adminThreadGet(req(), ctx)).status).toBe(401);
    expect((await adminSend(req({ clientId: "client-123", text: "hi", scope: "SHARED" }), ctx)).status).toBe(401);
    expect((await adminPhoto(req(), { params: Promise.resolve({ id: "b1", photoId: "a1" }) })).status).toBe(401);
    expect(m.sent).not.toHaveBeenCalled();
  });
});
