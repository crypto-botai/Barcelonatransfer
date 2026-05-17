import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type BookingStatus } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        confirmationCode: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupDatetime: true,
        vehicleClass: true,
        totalAmount: true,
        guestEmail: true,
        status: true,
        paymentStatus: true,
      },
    });
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(booking);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...(body.status    ? { status: body.status as BookingStatus } : {}),
        ...(body.driverId  ? { driverId: body.driverId, status: "DRIVER_ASSIGNED", driverAssignedAt: new Date() } : {}),
      },
    });
    return NextResponse.json(booking);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
