import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lookupFlight } from "@/lib/flights";

export const dynamic = "force-dynamic";

/**
 * Live flight status for one booking.
 *
 * Access is deliberately tied to a booking rather than exposing a bare
 * "look up any flight number" endpoint: the provider free tier is a finite
 * monthly quota, and an open endpoint is an easy way for a scraper to drain it.
 *
 * Authorised as either an authenticated staff/owner session, or possession of
 * the booking's confirmation code — which is what a guest customer has.
 *
 *   GET /api/flights/status?bookingId=...&code=ABC123
 */
export async function GET(req: NextRequest) {
  const bookingId = req.nextUrl.searchParams.get("bookingId");
  const code      = req.nextUrl.searchParams.get("code");

  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: {
      id: true, userId: true, driverId: true,
      flightNumber: true, pickupDatetime: true, confirmationCode: true,
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getServerSession(authOptions);
  const user    = session?.user as { id?: string; role?: string } | undefined;

  const authorised =
    (code && code === booking.confirmationCode) ||
    (user?.id && user.id === booking.userId) ||
    user?.role === "ADMIN" ||
    (user?.role === "DRIVER" && Boolean(booking.driverId));

  if (!authorised) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!booking.flightNumber) {
    return NextResponse.json({ tracked: false, reason: "no_flight_number" });
  }

  const outcome = await lookupFlight(booking.flightNumber, booking.pickupDatetime);

  if (!outcome.ok) {
    // Reported rather than papered over — the client shows different copy for
    // "tracking not enabled" than for "we couldn't find that flight number".
    return NextResponse.json({ tracked: false, reason: outcome.reason });
  }

  return NextResponse.json({ tracked: true, status: outcome.status });
}
