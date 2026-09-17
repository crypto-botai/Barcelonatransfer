import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartner, partnerBalance, partnerPeriodStats } from "@/lib/partner";

/** The numbers on the company's front page. */
export async function GET() {
  const p = await requirePartner();
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const [periods, balance, incoming, next, driverCount] = await Promise.all([
    partnerPeriodStats(p.id),
    partnerBalance(p.id),
    prisma.booking.count({ where: { partnerId: p.id, isDeleted: false, status: "CONFIRMED" } }),
    prisma.booking.findMany({
      where: { partnerId: p.id, isDeleted: false, status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] }, pickupDatetime: { gte: new Date(now.getTime() - 2 * 3600_000) } },
      orderBy: { pickupDatetime: "asc" },
      take: 6,
      select: {
        id: true, confirmationCode: true, status: true, pickupAddress: true, dropoffAddress: true,
        pickupDatetime: true, partnerPayout: true, passengers: true, vehicleClass: true,
        driver: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.driver.count({ where: { partnerId: p.id, status: { not: "SUSPENDED" } } }),
  ]);
  return NextResponse.json({ company: p.name, periods, balance, incoming, next, driverCount });
}
