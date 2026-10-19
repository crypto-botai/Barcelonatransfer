import { beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const db = vi.hoisted(() => ({ bookings: [] as Row[] }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driver: { findUnique: async () => ({ id: "d1", status: "ONLINE", partnerId: null, rating: 5, totalRides: 3 }) },
    booking: {
      findMany: async ({ where }: { where: Row }) =>
        db.bookings.filter((b) => b.driverId === where.driverId && b.status === where.status && !b.isDeleted &&
          where.OR.some((c: Row) => (c.rideEndedAt === null ? b.rideEndedAt === null && b.pickupDatetime >= c.pickupDatetime.gte : b.rideEndedAt !== null && b.rideEndedAt >= c.rideEndedAt.gte))),
    },
  },
}));

import { MemoryRateLimiter, setRateLimiter } from "@/lib/api/v1/rate-limit";
import { setAuditSink } from "@/lib/api/v1/audit";
import { mobileAuthConfig, signAccessToken } from "@/lib/api/v1/tokens";
import { GET } from "@/app/api/v1/driver/earnings/route";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const ride = (id: string, amount: number | null, ended: Date | null, pickup: Date): Row => ({
  id, confirmationCode: "C" + id, pickupAddress: "A", dropoffAddress: "B", driverAmount: amount, rideEndedAt: ended, pickupDatetime: pickup,
  driverId: "d1", status: "COMPLETED", isDeleted: false,
});

async function earnings() {
  const token = await signAccessToken({ userId: "du1", role: "DRIVER" as never, sessionId: "s1" }, mobileAuthConfig());
  const res = await GET(new Request("http://x/api/v1/driver/earnings", { headers: { authorization: `Bearer ${token}`, "x-forwarded-for": "10.9.0.1" } }), undefined as never);
  return (await res.json()).data as Row;
}

beforeEach(() => {
  process.env.MOBILE_JWT_SECRET = "test-only-mobile-secret-0123456789abcdef";
  process.env.NEXTAUTH_SECRET = "test-only-nextauth-secret-0123456789";
  setRateLimiter(new MemoryRateLimiter());
  setAuditSink(async () => {});
  db.bookings.length = 0;
});

describe("driver earnings", () => {
  it("counts a ride that ended with an end time", async () => {
    db.bookings.push(ride("1", 40, hoursAgo(1), hoursAgo(3)));
    const e = await earnings();
    expect(e.month.amount).toBeGreaterThanOrEqual(40);
    expect(e.recent[0]).toMatchObject({ id: "1", amount: 40 });
  });

  it("still counts a completed ride that has no end time, at its pickup time", async () => {
    db.bookings.push(ride("2", 55, null, hoursAgo(2)));
    const e = await earnings();
    expect(e.month.rides).toBeGreaterThanOrEqual(1);
    expect(e.month.amount).toBeGreaterThanOrEqual(55);
    expect(e.recent.map((r: Row) => r.id)).toContain("2");
    expect(e.recent[0].endedAt).toBeTruthy();
    expect(e.daily.reduce((s: number, d: Row) => s + d.amount, 0)).toBeGreaterThanOrEqual(55);
  });

  it("does not count another driver's, a deleted or a not-completed ride", async () => {
    db.bookings.push({ ...ride("3", 99, hoursAgo(1), hoursAgo(2)), driverId: "d2" }, { ...ride("4", 99, hoursAgo(1), hoursAgo(2)), isDeleted: true }, { ...ride("5", 99, hoursAgo(1), hoursAgo(2)), status: "CANCELLED" });
    const e = await earnings();
    expect(e.month.amount).toBe(0);
    expect(e.recent).toHaveLength(0);
  });

  it("lists rides newest first and says how many have no payout yet", async () => {
    db.bookings.push(ride("6", null, hoursAgo(5), hoursAgo(6)), ride("7", 20, hoursAgo(1), hoursAgo(2)), ride("8", 30, null, hoursAgo(3)));
    const e = await earnings();
    expect(e.recent.map((r: Row) => r.id)).toEqual(["7", "8", "6"]);
    expect(e.unpriced).toBe(1);
  });
});
