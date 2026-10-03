import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartner, partnerBalance, partnerPeriodStats } from "@/lib/partner";

/** The numbers on the company's front page. */
export async function GET() {
  const p = await requirePartner({ allowInactive: true });
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const soon = { gte: new Date(now.getTime() - 2 * 3600_000), lte: new Date(now.getTime() + 24 * 3600_000) };
  const [periods, balance, incoming, next, driverCount, flights, loads, drivers] = await Promise.all([
    partnerPeriodStats(p.id),
    partnerBalance(p.id),
    prisma.booking.count({ where: { partnerId: p.id, isDeleted: false, status: "CONFIRMED" } }),
    prisma.booking.findMany({
      where: { partnerId: p.id, isDeleted: false, status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] }, pickupDatetime: { gte: new Date(now.getTime() - 2 * 3600_000) } },
      orderBy: { pickupDatetime: "asc" },
      take: 6,
      select: {
        id: true, confirmationCode: true, status: true, pickupAddress: true, dropoffAddress: true,
        pickupDatetime: true, partnerPayout: true, passengers: true, vehicleClass: true, flightNumber: true,
        driver: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.driver.count({ where: { partnerId: p.id, status: { not: "SUSPENDED" } } }),
    // Flights landing in the next day, and who is busy: the two things a dispatcher checks first.
    prisma.booking.count({ where: { partnerId: p.id, isDeleted: false, flightNumber: { not: null }, status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] }, pickupDatetime: soon } }),
    prisma.booking.groupBy({
      by: ["driverId"],
      where: { partnerId: p.id, isDeleted: false, status: { in: ["DRIVER_ASSIGNED", "IN_PROGRESS"] }, driverId: { not: null }, pickupDatetime: soon },
      _count: true,
    }),
    prisma.driver.findMany({
      where: { partnerId: p.id, status: { notIn: ["SUSPENDED", "PENDING_APPROVAL"] } },
      take: 30,
      select: { id: true, status: true, user: { select: { name: true } } },
    }),
  ]);
  const busy = new Map(loads.map((l) => [l.driverId, l._count]));
  const roster = drivers.map((d) => ({ id: d.id, name: d.user.name ?? "Driver", status: d.status, jobs: busy.get(d.id) ?? 0 }));
  return NextResponse.json({ company: p.name, periods, balance, incoming, next, driverCount, flights, roster });
}
