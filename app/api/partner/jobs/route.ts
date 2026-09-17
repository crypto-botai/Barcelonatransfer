import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/partner";

/**
 * The company's jobs. Everything the office has sent it, newest pick-up
 * first, with the driver it put on each. The customer's fare is not here —
 * the company sees its payout, and what it chose to show its driver.
 */
export async function GET(req: NextRequest) {
  const p = await requirePartner();
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
      guestName: true, guestPhone: true,
      pickupAddress: true, dropoffAddress: true, pickupDatetime: true,
      passengers: true, luggage: true, vehicleClass: true, flightNumber: true, specialRequests: true,
      partnerPayout: true, driverAmount: true, partnerAssignedAt: true, partnerDispatchedAt: true,
      rideStage: true, rideEndedAt: true,
      driverId: true,
      driver: { select: { id: true, user: { select: { name: true, phone: true } }, vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } } } },
    },
  });
  return NextResponse.json(jobs);
}
