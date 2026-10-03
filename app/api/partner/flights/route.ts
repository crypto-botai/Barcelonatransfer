import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/partner";

export const dynamic = "force-dynamic";

/**
 * Every job with a flight on it, from a few hours ago to a week ahead.
 *
 * This is the list. The live status of each flight is read one at a time from
 * /api/flights/status, which checks the job belongs to this company and caches
 * for ten minutes, so opening this page costs the flight provider's monthly
 * allowance nothing it was not going to spend.
 *
 * No money is selected. A flight board has no use for a fare, and the browser
 * can read whatever this sends.
 */
export async function GET() {
  const p = await requirePartner({ allowInactive: true });
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  const jobs = await prisma.booking.findMany({
    where: {
      partnerId: p.id,
      isDeleted: false,
      flightNumber: { not: null },
      status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] },
      pickupDatetime: { gte: new Date(now - 6 * 3600_000), lte: new Date(now + 7 * 86_400_000) },
    },
    orderBy: { pickupDatetime: "asc" },
    take: 120,
    select: {
      id: true, confirmationCode: true, status: true, flightNumber: true, pickupDatetime: true,
      pickupAddress: true, dropoffAddress: true, passengers: true, luggage: true,
      guestName: true, guestPhone: true,
      driver: { select: { user: { select: { name: true, phone: true } } } },
    },
  });

  return NextResponse.json({ jobs: jobs.filter((j) => j.flightNumber?.trim()) });
}
