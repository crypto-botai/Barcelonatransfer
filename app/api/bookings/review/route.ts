import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { bookingId, rating, review } = await req.json() as {
      bookingId: string;
      rating: number;
      review?: string;
    };

    if (!bookingId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, rating: true, driverId: true },
    });

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.rating !== null) return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
    if (booking.status !== "COMPLETED") return NextResponse.json({ error: "Booking not completed" }, { status: 400 });

    await prisma.booking.update({
      where: { id: bookingId },
      data:  { rating, review: review?.trim() ?? null },
    });

    // Update driver's average rating
    if (booking.driverId) {
      const driverBookings = await prisma.booking.findMany({
        where:  { driverId: booking.driverId, rating: { not: null } },
        select: { rating: true },
      });
      const avg = driverBookings.reduce((sum, b) => sum + (b.rating ?? 0), 0) / driverBookings.length;
      await prisma.driver.update({
        where: { id: booking.driverId },
        data:  { rating: Math.round(avg * 10) / 10, totalRides: { increment: 0 } },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
