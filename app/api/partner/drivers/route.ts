import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePartner, createPartnerDriver } from "@/lib/partner";

export async function GET() {
  const p = await requirePartner({ allowInactive: true });
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const drivers = await prisma.driver.findMany({
    where: { partnerId: p.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, status: true, licenseNumber: true, rating: true, totalRides: true, createdAt: true,
      user: { select: { name: true, email: true, phone: true } },
      vehicles: { take: 1, select: { id: true, make: true, model: true, licensePlate: true, class: true, color: true } },
      _count: { select: { bookings: { where: { isDeleted: false, status: { in: ["DRIVER_ASSIGNED", "IN_PROGRESS"] } } } } },
    },
  });
  return NextResponse.json(drivers);
}

const schema = z.object({
  name:          z.string().min(2),
  email:         z.string().email(),
  phone:         z.string().min(6),
  licenseNumber: z.string().optional(),
  vehicleMake:   z.string().min(1),
  vehicleModel:  z.string().min(1),
  vehiclePlate:  z.string().min(2),
  vehicleClass:  z.enum(["ECONOMY", "BUSINESS", "LUXURY", "ELECTRIC_VIP", "MINIVAN", "LUXURY_MINIVAN", "MINIBUS"]),
  vehicleColor:  z.string().optional(),
});

/** Adding a driver creates their portal login and emails them the password. */
export async function POST(req: NextRequest) {
  const p = await requirePartner();
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  try {
    const driver = await createPartnerDriver(p.id, parsed.data);
    return NextResponse.json({ id: driver.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not add the driver" }, { status: 400 });
  }
}
