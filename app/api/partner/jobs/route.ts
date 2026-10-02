import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/partner";

/**
 * The company's jobs. Everything the office has sent it, newest pick-up
 * first, with the driver it put on each. The customer's fare is not here —
 * the company sees its payout, and what it chose to show its driver.
 */
export async function GET(req: NextRequest) {
  const p = await requirePartner({ allowInactive: true });
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = req.nextUrl.searchParams.get("scope") ?? "all";
  const status =
    scope === "incoming"  ? { in: ["CONFIRMED" as const] } :
    scope === "active"    ? { in: ["DRIVER_ASSIGNED" as const, "IN_PROGRESS" as const] } :
    scope === "completed" ? { in: ["COMPLETED" as const] } :
    scope === "cancelled" ? { in: ["CANCELLED" as const, "REFUNDED" as const] } :
    undefined;

  const jobs = await prisma.booking.findMany({
    where: { partnerId: p.id, isDeleted: false, ...(status ? { status } : {}) },
    orderBy: { pickupDatetime: scope === "completed" || scope === "cancelled" ? "desc" : "asc" },
    take: 300,
    select: {
      id: true, confirmationCode: true, status: true,
      // The company is driving this person. It needs to be able to reach them
      // without ringing the office, which means the address as well as the
      // phone: a flight that lands at 01:30 is not a moment to be calling.
      guestName: true, guestPhone: true, guestEmail: true,
      pickupAddress: true, dropoffAddress: true, pickupDatetime: true,
      pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true,
      passengers: true, luggage: true, vehicleClass: true, flightNumber: true, specialRequests: true,
      partnerPayout: true, driverAmount: true, partnerAssignedAt: true, partnerDispatchedAt: true,
      // What the driver collects from the client, if anything.
      totalAmount: true, paymentStatus: true, paymentMethod: true, balanceAmount: true, balancePaidAt: true,
      rideStage: true, rideEndedAt: true,
      driverId: true,
      noShow: { select: { images: true, note: true, waitedMin: true, createdAt: true, lat: true, lng: true } },
      driver: { select: { id: true, user: { select: { name: true, phone: true } }, vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } } } },
    },
  });
  /**
   * How many jobs sit behind each tab.
   *
   * Without these an empty tab is indistinguishable from an empty portal. A
   * company whose only job was already dispatched opened Incoming, read "no
   * job is waiting", and concluded the panel could not do any of this - the
   * job, the driver on it and the dispatch button were all one tab away.
   */
  const base = { partnerId: p.id, isDeleted: false };
  const [incoming, active, completed, cancelled] = await Promise.all([
    prisma.booking.count({ where: { ...base, status: "CONFIRMED" } }),
    prisma.booking.count({ where: { ...base, status: { in: ["DRIVER_ASSIGNED", "IN_PROGRESS"] } } }),
    prisma.booking.count({ where: { ...base, status: "COMPLETED" } }),
    prisma.booking.count({ where: { ...base, status: { in: ["CANCELLED", "REFUNDED"] } } }),
  ]);

  return NextResponse.json({ jobs, counts: { incoming, active, completed, cancelled } });
}
