import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { BOOKING_TIMEZONE } from "@/lib/datetime";
import { madridPeriods, requireDriver } from "@/lib/api/v1/driver-rides";

export const dynamic = "force-dynamic";

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: BOOKING_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /api/v1/driver/earnings
 *
 * The driver's OWN payout for completed rides: today, this week (from Monday),
 * this month, with the number of rides, and the ten most recent. The figure is
 * `driverAmount`, what the office or company set for the driver. The customer's
 * price is never selected here, so it cannot be sent.
 */
export const GET = apiHandler(
  "driver.earnings",
  async ({ auth }) => {
    const driver = await requireDriver(auth!.userId);
    const p = madridPeriods(new Date());

    // The chart needs the last 30 days even at the start of a month, so read from whichever is earlier.
    const since = new Date(Math.min(p.month.getTime(), Date.now() - 31 * 86_400_000));
    const rows = await prisma.booking.findMany({
      where: { driverId: driver.id, status: "COMPLETED", isDeleted: false, rideEndedAt: { gte: since } },
      orderBy: { rideEndedAt: "desc" },
      select: { id: true, confirmationCode: true, pickupAddress: true, dropoffAddress: true, driverAmount: true, rideEndedAt: true },
    });

    const sum = (from: Date) => {
      const inRange = rows.filter((r) => r.rideEndedAt && r.rideEndedAt >= from);
      return { rides: inRange.length, amount: r2(inRange.reduce((s, r) => s + (r.driverAmount ?? 0), 0)), currency: "EUR" };
    };

    // One point per Madrid day for the last 30 days, oldest first, empty days included so the chart has no gaps.
    const byDay = new Map<string, { amount: number; rides: number }>();
    for (const r of rows) {
      if (!r.rideEndedAt) continue;
      const k = dayKey(r.rideEndedAt);
      const cur = byDay.get(k) ?? { amount: 0, rides: 0 };
      cur.amount += r.driverAmount ?? 0;
      cur.rides += 1;
      byDay.set(k, cur);
    }
    const daily = Array.from({ length: 30 }, (_, i) => {
      const date = dayKey(new Date(Date.now() - (29 - i) * 86_400_000));
      const v = byDay.get(date);
      return { date, amount: r2(v?.amount ?? 0), rides: v?.rides ?? 0 };
    });

    return {
      daily,
      today: sum(p.today),
      week: sum(p.week),
      month: sum(p.month),
      recent: rows.slice(0, 10).map((r) => ({
        id: r.id,
        code: r.confirmationCode,
        route: `${r.pickupAddress}${r.dropoffAddress.trim() ? ` → ${r.dropoffAddress}` : ""}`,
        amount: r.driverAmount,
        endedAt: r.rideEndedAt ? r.rideEndedAt.toISOString() : null,
      })),
      // Rides completed this month with no payout set: the office has not priced them for the driver yet.
      unpriced: rows.filter((r) => r.driverAmount === null && r.rideEndedAt && r.rideEndedAt >= p.month).length,
    };
  },
  { auth: { roles: ["DRIVER"] } },
);
