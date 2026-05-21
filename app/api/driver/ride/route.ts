import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookingStatus, DriverStatus } from "@prisma/client";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !user?.id || user.role !== "DRIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId, action } = await req.json() as {
    bookingId: string;
    action: "START" | "COMPLETE";
  };

  if (!bookingId || !["START", "COMPLETE"].includes(action)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const driver = await prisma.driver.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, driverId: true, status: true },
  });

  if (!booking || booking.driverId !== driver.id) {
    return NextResponse.json({ error: "Booking not found or not assigned to you" }, { status: 403 });
  }

  if (action === "START") {
    if (booking.status !== BookingStatus.DRIVER_ASSIGNED && booking.status !== BookingStatus.CONFIRMED) {
      return NextResponse.json({ error: "Booking is not in an assignable state" }, { status: 400 });
    }
    const [updated] = await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.IN_PROGRESS,
          rideStartedAt: new Date(),
        },
      }),
      prisma.driver.update({
        where: { id: driver.id },
        data: { status: DriverStatus.ON_RIDE },
      }),
    ]);
    return NextResponse.json({ status: updated.status });
  }

  // COMPLETE
  if (booking.status !== BookingStatus.IN_PROGRESS) {
    return NextResponse.json({ error: "Ride is not in progress" }, { status: 400 });
  }
  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.COMPLETED,
        rideEndedAt: new Date(),
        paymentStatus: "PAID",
      },
    }),
    prisma.driver.update({
      where: { id: driver.id },
      data: {
        status: DriverStatus.ONLINE,
        totalRides: { increment: 1 },
      },
    }),
  ]);
  return NextResponse.json({ status: updated.status });
}
