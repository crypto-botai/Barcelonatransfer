import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendDriverAssignedEmail } from "@/lib/resend";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        confirmationCode: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupDatetime: true,
        vehicleClass: true,
        passengers: true,
        luggage: true,
        totalAmount: true,
        guestEmail: true,
        guestName: true,
        status: true,
        paymentStatus: true,
        flightNumber: true,
        specialRequests: true,
        createdAt: true,
        driver: {
          select: {
            user: { select: { name: true, image: true, phone: true } },
            rating: true,
            vehicles: { take: 1, select: { make: true, model: true, licensePlate: true, color: true } },
          },
        },
        tracking: {
          orderBy: { createdAt: "asc" },
          select: { lat: true, lng: true, speed: true, heading: true, createdAt: true },
        },
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
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    // Allow customers to cancel their own bookings
    if (sessionUser?.role !== "ADMIN") {
      if (body.status !== "CANCELLED") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const booking = await prisma.booking.findUnique({ where: { id }, select: { userId: true, status: true } });
      if (!booking || booking.userId !== sessionUser?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      if (!["PENDING", "CONFIRMED"].includes(booking.status)) return NextResponse.json({ error: "Cannot cancel at this stage" }, { status: 400 });
      const updated = await prisma.booking.update({ where: { id }, data: { status: "CANCELLED" }, select: { id: true, status: true } });
      return NextResponse.json(updated);
    }
    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.adminNotes !== undefined) data.adminNotes = body.adminNotes;
    if (body.totalAmount !== undefined) data.totalAmount = parseFloat(body.totalAmount);
    if (body.driverAmount !== undefined) data.driverAmount = body.driverAmount === null ? null : parseFloat(body.driverAmount);
    const isNewDriverAssignment = body.driverId && body.driverId !== (await prisma.booking.findUnique({ where: { id }, select: { driverId: true } }))?.driverId;
    if (body.driverId) {
      data.driverId = body.driverId;
      data.status = "DRIVER_ASSIGNED";
      data.driverAssignedAt = new Date();
    }
    const booking = await prisma.booking.update({
      where: { id }, data,
      include: {
        driver: {
          include: {
            user: { select: { name: true, phone: true } },
            vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } },
          },
        },
      },
    });

    // Send customer notification when driver is newly assigned
    if (isNewDriverAssignment && booking.guestEmail && booking.driver) {
      const driverName  = booking.driver.user.name ?? "Your Driver";
      const driverPhone = booking.driver.user.phone ?? booking.driver.whatsappNumber ?? "";
      const vehicle     = booking.driver.vehicles[0];
      sendDriverAssignedEmail({
        to:           booking.guestEmail,
        name:         booking.guestName ?? "Guest",
        confirmationCode: booking.confirmationCode,
        driverName,
        driverPhone,
        vehicleMake:  vehicle?.make  ?? "Vehicle",
        vehicleModel: vehicle?.model ?? "",
        licensePlate: vehicle?.licensePlate ?? "",
        pickupDatetime: new Date(booking.pickupDatetime).toLocaleString("en-GB"),
      }).catch(() => {}); // fire-and-forget
    }

    return NextResponse.json(booking);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
