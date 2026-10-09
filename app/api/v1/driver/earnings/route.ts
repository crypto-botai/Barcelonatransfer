import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { madridPeriods, requireDriver } from "@/lib/api/v1/driver-rides";

export const dynamic = "force-dynamic";

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

    const rows = await prisma.booking.findMany({
      where: { driverId: driver.id, status: "COMPLETED", isDeleted: false, rideEndedAt: { gte: p.month } },
      orderBy: { rideEndedAt: "desc" },
      select: { id: true, confirmationCode: true, pickupAddress: true, dropoffAddress: true, driverAmount: true, rideEndedAt: true },
    });

    const sum = (since: Date) => {
      const inRange = rows.filter((r) => r.rideEndedAt && r.rideEndedAt >= since);
      return { rides: inRange.length, amount: r2(inRange.reduce((s, r) => s + (r.driverAmount ?? 0), 0)), currency: "EUR" };
    };

    return {
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
      unpriced: rows.filter((r) => r.driverAmount === null).length,
    };
  },
  { auth: { roles: ["DRIVER"] } },
);
