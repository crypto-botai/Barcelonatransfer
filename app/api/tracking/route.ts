import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/request-session";
import { fixProblem } from "@/lib/api/v1/gps-fix";
import { codeAccessAllowed, recordFailure, safeEqual, tooManyFailures, verifyTrackingToken } from "@/lib/tracking-access";

export const dynamic = "force-dynamic";

const pingSchema = z.object({
  bookingId: z.string().min(1),
  lat:       z.number().min(-90).max(90),
  lng:       z.number().min(-180).max(180),
  speed:     z.number().min(0).max(120).optional(),   // m/s; 120 m/s ≈ 430 km/h
  heading:   z.number().min(0).max(360).optional(),
  accuracy:  z.number().min(0).max(100_000).optional(),
  at:        z.number().int().positive().optional(),
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
  const session = await getRequestSession();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !user?.id || user.role !== "DRIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = pingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { bookingId, lat, lng, speed, heading, accuracy, at } = parsed.data;
  // The same checks as /api/v1: no old, imprecise, future-dated or 0,0 positions.
  const problem = fixProblem({ lat, lng, accuracy, at });
  if (problem) return NextResponse.json({ error: problem }, { status: 422 });

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
  // Only while the ride is live: a completed, cancelled or not-yet-confirmed booking takes no positions.
  if (booking.status !== "DRIVER_ASSIGNED" && booking.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Location is not shared for this ride right now." }, { status: 409 });
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
  const token     = searchParams.get("t");
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const client = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (tooManyFailures(client)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: { id: true, userId: true, driverId: true, confirmationCode: true, status: true, partnerId: true, isDeleted: true },
  });

  const session = await getServerSession(authOptions);
  const user    = session?.user as { id?: string; role?: string } | undefined;

  // The company that dispatched the driver may watch the ride it is
  // responsible for, and no other.
  let partnerOk = false;
  if (booking && user?.role === "PARTNER" && user.id && booking.partnerId) {
    const p = await prisma.fleetPartner.findUnique({ where: { userId: user.id }, select: { id: true } });
    partnerOk = Boolean(p && p.id === booking.partnerId);
  }

  // A driver may read the position of a ride they are assigned to, and no other.
  let assignedDriver = false;
  if (booking && user?.role === "DRIVER" && user.id && booking.driverId) {
    const d = await prisma.driver.findUnique({ where: { userId: user.id }, select: { id: true } });
    assignedDriver = Boolean(d && d.id === booking.driverId);
  }

  // Public page access: a signed tracking token (preferred), or, for links and clients that predate it, the confirmation code
  // (constant-time compare; can be switched off with TRACKING_ALLOW_CODE=0). See lib/tracking-access.ts.
  const byToken = Boolean(booking && token && verifyTrackingToken(token, booking.id));
  const byCode  = Boolean(booking && code && codeAccessAllowed() && safeEqual(code, booking.confirmationCode));

  const authorised =
    Boolean(booking && !booking.isDeleted) &&
    (byToken ||
      byCode ||
      Boolean(user?.id && user.id === booking?.userId) ||
      user?.role === "ADMIN" ||
      assignedDriver ||
      partnerOk);

  // An unknown booking and a wrong credential give the same answer, so this cannot be used to find which ids exist.
  if (!booking || !authorised) {
    if (code || token) recordFailure(client);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Which credential opened it, counted in the logs (no code, token, booking id or address is logged), so the day the bare code is no
  // longer used can be seen before TRACKING_ALLOW_CODE is set to 0.
  const method = byToken ? "token" : byCode ? "code" : user?.role === "ADMIN" ? "admin" : assignedDriver ? "driver" : partnerOk ? "partner" : "owner";
  console.info(JSON.stringify({ evt: "tracking_access", method }));

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

  // The recent trail, for a map that draws the route so far. Only for staff and the assigned driver/partner: a public link
  // holder sees the car now, not where it has been.
  const mayTrail = user?.role === "ADMIN" || assignedDriver || partnerOk;
  const trail = searchParams.get("trail") && mayTrail
    ? await prisma.rideTracking.findMany({
        where: { bookingId }, orderBy: { createdAt: "desc" }, take: 60,
        select: { lat: true, lng: true, speed: true, heading: true, createdAt: true },
      })
    : undefined;

  return NextResponse.json({ live: Boolean(latest), status: booking.status, point: latest ?? null, trail: trail?.reverse() });
}
