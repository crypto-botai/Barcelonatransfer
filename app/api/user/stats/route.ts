import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string };

  const [bookings, profile] = await Promise.all([
    prisma.booking.findMany({
      where: { userId: user.id },
      select: {
        id: true, status: true, paymentStatus: true, totalAmount: true,
        pickupDatetime: true, pickupAddress: true, dropoffAddress: true,
        vehicleClass: true, passengers: true, luggage: true,
        confirmationCode: true, createdAt: true, driverId: true,
        flightNumber: true,
        driver: {
          select: {
            user: { select: { name: true, image: true } },
            rating: true,
            vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } },
          },
        },
      },
      orderBy: { pickupDatetime: "asc" },
    }),
    prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { isVip: true, totalSpent: true, totalRides: true },
    }),
  ]);

  const now = new Date();
  const upcoming = bookings.filter(
    b => new Date(b.pickupDatetime) >= now && !["CANCELLED", "COMPLETED", "REFUNDED"].includes(b.status)
  );
  const completed = bookings.filter(b => b.status === "COMPLETED");
  const cancelled = bookings.filter(b => b.status === "CANCELLED");
  const totalSpent = bookings
    .filter(b => b.paymentStatus === "PAID")
    .reduce((s, b) => s + b.totalAmount, 0);

  const loyaltyPoints = Math.floor(totalSpent * 2);

  return NextResponse.json({
    totalBookings:    bookings.length,
    upcomingCount:    upcoming.length,
    completedCount:   completed.length,
    cancelledCount:   cancelled.length,
    totalSpent,
    loyaltyPoints,
    memberTier:       profile?.isVip ? "VIP" : totalSpent >= 1000 ? "Gold" : "Silver",
    upcomingBookings: upcoming.slice(0, 3),
    recentBookings:   bookings.slice(-10).reverse(),
    nextBooking:      upcoming[0] ?? null,
  });
}
