import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return session;
}

const patchSchema = z.object({
  status:       z.enum(["PENDING_APPROVAL", "APPROVED", "SUSPENDED", "OFFLINE", "ONLINE", "ON_RIDE"]).optional(),
  name:         z.string().min(2).optional(),
  phone:        z.string().min(6).optional(),
  email:        z.string().email().optional(),
  vehiclePlate: z.string().min(2).optional(),
  vehicleClass: z.enum(["ECONOMY", "BUSINESS", "LUXURY", "ELECTRIC_VIP", "MINIVAN", "LUXURY_MINIVAN", "MINIBUS"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = patchSchema.parse(await req.json());

    const driver = await prisma.driver.findUnique({
      where: { id },
      include: { user: true, vehicles: { take: 1 } },
    });
    if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

    if (body.email && body.email !== driver.user.email) {
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (body.name || body.phone || body.email) {
        await tx.user.update({
          where: { id: driver.userId },
          data: {
            ...(body.name  !== undefined && { name: body.name }),
            ...(body.phone !== undefined && { phone: body.phone }),
            ...(body.email !== undefined && { email: body.email }),
          },
        });
      }

      if (body.status || body.phone) {
        await tx.driver.update({
          where: { id },
          data: {
            ...(body.status !== undefined && { status: body.status }),
            ...(body.phone  !== undefined && { whatsappNumber: body.phone }),
          },
        });
      }

      if ((body.vehiclePlate || body.vehicleClass) && driver.vehicles[0]) {
        await tx.vehicle.update({
          where: { id: driver.vehicles[0].id },
          data: {
            ...(body.vehiclePlate !== undefined && { licensePlate: body.vehiclePlate.toUpperCase() }),
            ...(body.vehicleClass !== undefined && { class: body.vehicleClass as never }),
          },
        });
      }
    });

    const updated = await prisma.driver.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const driver = await prisma.driver.findUnique({
    where: { id },
    include: {
      vehicles: { include: { _count: { select: { bookings: true } } } },
      _count: { select: { bookings: true, withdrawals: true } },
    },
  });
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  // Never destroy ride or payment history — suspending keeps the driver out of
  // dispatch while preserving records needed for accounting/disputes.
  if (driver._count.bookings > 0 || driver._count.withdrawals > 0) {
    return NextResponse.json(
      { error: "This driver has ride or payment history and can't be deleted — suspend them instead to preserve records." },
      { status: 409 }
    );
  }

  const vehiclesToDelete = driver.vehicles.filter((v) => v._count.bookings === 0).map((v) => v.id);
  const vehiclesToDetach = driver.vehicles.filter((v) => v._count.bookings > 0).map((v) => v.id);

  if (vehiclesToDelete.length) await prisma.vehicle.deleteMany({ where: { id: { in: vehiclesToDelete } } });
  if (vehiclesToDetach.length) await prisma.vehicle.updateMany({ where: { id: { in: vehiclesToDetach } }, data: { driverId: null, isActive: false } });

  // Deleting the user cascades to the Driver row (schema onDelete: Cascade on Driver.user).
  await prisma.user.delete({ where: { id: driver.userId } });

  return NextResponse.json({ ok: true });
}
