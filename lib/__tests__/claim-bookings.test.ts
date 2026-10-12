import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  guestCount: 0,
  recentLog: null as null | { id: string },
  updated: [] as Array<Record<string, unknown>>,
  logs: [] as Array<Record<string, unknown>>,
  verified: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      count: async () => db.guestCount,
      updateMany: async (args: Record<string, unknown>) => {
        db.updated.push(args);
        return { count: db.guestCount };
      },
    },
    user: { updateMany: async (args: Record<string, unknown>) => { db.verified.push(args); return { count: 1 }; } },
    activityLog: {
      findFirst: async () => db.recentLog,
      create: async (args: Record<string, unknown>) => { db.logs.push(args); return {}; },
    },
  },
}));

process.env.NEXTAUTH_SECRET = "test-secret-for-claim-tokens";

import { linkGuestBookings, offerToClaimBookings, signClaimToken, verifyClaimToken } from "@/lib/claim-bookings";

beforeEach(() => {
  db.guestCount = 0;
  db.recentLog = null;
  db.updated = [];
  db.logs = [];
  db.verified = [];
});

describe("claim token", () => {
  it("round-trips the account and the lower-cased email", () => {
    const t = signClaimToken("u1", "Anna@Example.com");
    expect(verifyClaimToken(t)).toEqual({ userId: "u1", email: "anna@example.com" });
  });

  it("rejects a changed, mis-signed or expired token", () => {
    const t = signClaimToken("u1", "a@b.co", 1_000);
    expect(verifyClaimToken(t, 1_000 + 8 * 24 * 3600_000)).toBeNull();
    const [payload] = t.split(".");
    expect(verifyClaimToken(`${payload}.AAAA`)).toBeNull();
    const forged = Buffer.from(JSON.stringify({ u: "someone-else", e: "a@b.co", x: Date.now() + 1e9 })).toString("base64url");
    expect(verifyClaimToken(`${forged}.${t.split(".")[1]}`)).toBeNull();
    expect(verifyClaimToken("garbage")).toBeNull();
  });
});

describe("linkGuestBookings", () => {
  it("gives the account only bookings that have no owner and the same email (any letter case), and marks the email verified", async () => {
    db.guestCount = 2;
    await expect(linkGuestBookings("u1", "Anna@Example.com")).resolves.toBe(2);
    expect(db.updated[0]).toMatchObject({ where: { userId: null, guestEmail: { equals: "Anna@Example.com", mode: "insensitive" } }, data: { userId: "u1" } });
    expect(db.verified).toHaveLength(1);
  });

  it("changes nothing when there are no such bookings", async () => {
    await expect(linkGuestBookings("u1", "a@b.co")).resolves.toBe(0);
    expect(db.verified).toHaveLength(0);
  });
});

describe("offerToClaimBookings", () => {
  const user = { id: "u1", email: "anna@example.com", name: "Anna", role: "CUSTOMER" };

  it("emails a link when guest bookings exist, and records it", async () => {
    db.guestCount = 1;
    const send = vi.fn(async () => undefined);
    await expect(offerToClaimBookings(user, send)).resolves.toBe("sent");
    expect(send).toHaveBeenCalledOnce();
    const call = (send.mock.calls[0] as unknown as [{ to: string; count: number; claimUrl: string }])[0];
    expect(call).toMatchObject({ to: "anna@example.com", count: 1 });
    expect(call.claimUrl).toContain("/api/auth/claim-bookings?token=");
    expect(db.logs).toHaveLength(1);
  });

  it("does nothing when there are no guest bookings", async () => {
    const send = vi.fn();
    await expect(offerToClaimBookings(user, send)).resolves.toBe("none");
    expect(send).not.toHaveBeenCalled();
  });

  it("does not email twice within twelve hours", async () => {
    db.guestCount = 3;
    db.recentLog = { id: "log1" };
    const send = vi.fn();
    await expect(offerToClaimBookings(user, send)).resolves.toBe("recent");
    expect(send).not.toHaveBeenCalled();
  });

  it("is for customers only", async () => {
    db.guestCount = 3;
    const send = vi.fn();
    await expect(offerToClaimBookings({ ...user, role: "DRIVER" }, send)).resolves.toBe("none");
    expect(send).not.toHaveBeenCalled();
  });

  it("never throws if sending fails", async () => {
    db.guestCount = 1;
    await expect(offerToClaimBookings(user, async () => { throw new Error("mail down"); })).resolves.toBe("none");
  });
});
