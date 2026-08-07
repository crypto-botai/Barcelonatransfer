import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const pingSchema = z.object({
  bookingId: z.string().min(1),
  lat:       z.number().min(-90).max(90),
  lng:       z.number().min(-180).max(180),
  speed:     z.number().min(0).max(120).optional(),   // m/s; 120 m/s ≈ 430 km/h
  heading:   z.number().min(0).max(360).optional(),
});

/**
 * Driver location ping.
 *
 * Previously this trusted whatever bookingId the caller sent: any authenticated
 * driver could write GPS points onto any booking in the system, including one
 * belonging to another driver. The booking is now resolved through the calling
 * driver's own record, and coordinates are range-checked.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !user?.id || user.role !== "DRIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = pingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { bookingId, lat, lng, speed, heading } = parsed.data;

  const driver = await prisma.driver.findUnique({
    where:  { userId: user.id },
    select: { id: true },
  });
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  // The ping is only accepted for a ride this driver is actually on. Anything
  // else is a 403 rather than a silent write to someone else's booking.
  const booking = await prisma.booking.findFirst({
    where:  { id: bookingId, driverId: driver.id },
    select: { id: true, status: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not assigned to you" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.rideTracking.create({ data: { bookingId, lat, lng, speed, heading } }),
    prisma.driver.update({
      where: { id: driver.id },
      data:  { currentLat: lat, currentLng: lng, lastLocationAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

/**
 * Latest position for one booking.
 *
 * This was open to anyone who had a bookingId — an unauthenticated endpoint
 * disclosing a driver's live coordinates. It now requires either the booking's
 * confirmation code (which the customer has, and which backs the public
 * /track/{code} page) or an authorised session.
 *
 *   GET /api/tracking?bookingId=...&code=...
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId");
  const code      = searchParams.get("code");
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: { id: true, userId: true, driverId: true, confirmationCode: true, status: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getServerSession(authOptions);
  const user    = session?.user as { id?: string; role?: string } | undefined;

  const authorised =
    (code && code === booking.confirmationCode) ||
    (user?.id && user.id === booking.userId) ||
    user?.role === "ADMIN" ||
    user?.role === "DRIVER";

  if (!authorised) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Location is only shared while it is operationally relevant. Once the ride
  // is over, the trail stops being something the customer needs and becomes a
  // record of where a driver has been.
  if (booking.status !== "IN_PROGRESS" && booking.status !== "DRIVER_ASSIGNED") {
    return NextResponse.json({ live: false, status: booking.status });
  }

  const latest = await prisma.rideTracking.findFirst({
    where:   { bookingId },
    orderBy: { createdAt: "desc" },
    select:  { lat: true, lng: true, speed: true, heading: true, createdAt: true },
  });

  return NextResponse.json({ live: Boolean(latest), status: booking.status, point: latest ?? null });
}
