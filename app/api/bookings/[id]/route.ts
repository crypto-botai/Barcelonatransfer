import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.adminNotes !== undefined) data.adminNotes = body.adminNotes;
    if (body.totalAmount !== undefined) data.totalAmount = parseFloat(body.totalAmount);
    if (body.driverAmount !== undefined) data.driverAmount = body.driverAmount === null ? null : parseFloat(body.driverAmount);
    if (body.driverId) {
      data.driverId = body.driverId;
      data.status = "DRIVER_ASSIGNED";
      data.driverAssignedAt = new Date();
    }
    const booking = await prisma.booking.update({ where: { id }, data });
    return NextResponse.json(booking);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
