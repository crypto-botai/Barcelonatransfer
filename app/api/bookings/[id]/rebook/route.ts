import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Prefill data for repeating a past journey.
 *
 * Deliberately does NOT create a booking or reuse the old price. It returns the
 * route and preferences so the booking form can open pre-filled, and the fare
 * is quoted fresh from the current price table. Copying a months-old fare
 * forward would let a customer book at a rate that no longer exists.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findFirst({
    // Scoped to the caller: a booking id belonging to someone else simply is
    // not found, rather than leaking its route.
    where:  { id, userId },
    select: {
      pickupAddress: true, pickupLat: true, pickupLng: true,
      dropoffAddress: true, dropoffLat: true, dropoffLng: true,
      vehicleClass: true, passengers: true, luggage: true,
      guestName: true, guestEmail: true, guestPhone: true,
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Flight number and special requests are deliberately omitted — they belonged
  // to that trip, and a stale flight number on a new booking sends a driver to
  // meet an aircraft that is not landing.
  const query = new URLSearchParams({
    pickup:      booking.pickupAddress,
    pickupLat:   String(booking.pickupLat),
    pickupLng:   String(booking.pickupLng),
    dropoff:     booking.dropoffAddress,
    dropoffLat:  String(booking.dropoffLat),
    dropoffLng:  String(booking.dropoffLng),
    vehicle:     booking.vehicleClass,
    passengers:  String(booking.passengers),
    luggage:     String(booking.luggage),
  });

  return NextResponse.json({
    ok: true,
    url: `/book?${query.toString()}`,
    summary: `${booking.pickupAddress} → ${booking.dropoffAddress}`,
  });
}
