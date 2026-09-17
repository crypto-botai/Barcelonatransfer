import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/partner";

const schema = z.object({
  name:          z.string().min(2).optional(),
  phone:         z.string().min(6).optional(),
  licenseNumber: z.string().nullable().optional(),
  /** APPROVED puts them back on the roster; SUSPENDED takes them off. */
  status:        z.enum(["APPROVED", "SUSPENDED"]).optional(),
  vehicleMake:   z.string().min(1).optional(),
  vehicleModel:  z.string().min(1).optional(),
  vehiclePlate:  z.string().min(2).optional(),
  vehicleClass:  z.enum(["ECONOMY", "BUSINESS", "LUXURY", "ELECTRIC_VIP", "MINIVAN", "LUXURY_MINIVAN", "MINIBUS"]).optional(),
  vehicleColor:  z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await requirePartner();
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  const d = parsed.data;

  const driver = await prisma.driver.findFirst({ where: { id, partnerId: p.id }, include: { vehicles: { take: 1 } } });
  if (!driver) return NextResponse.json({ error: "Not one of your drivers" }, { status: 404 });

  await prisma.$transaction([
    prisma.driver.update({
      where: { id },
      data: {
        ...(d.status ? { status: d.status } : {}),
        ...(d.licenseNumber !== undefined ? { licenseNumber: d.licenseNumber } : {}),
        ...(d.phone ? { whatsappNumber: d.phone } : {}),
      },
    }),
    prisma.user.update({
      where: { id: driver.userId },
      data: { ...(d.name ? { name: d.name } : {}), ...(d.phone ? { phone: d.phone } : {}) },
    }),
    ...(driver.vehicles[0] && (d.vehicleMake || d.vehicleModel || d.vehiclePlate || d.vehicleClass || d.vehicleColor)
      ? [prisma.vehicle.update({
          where: { id: driver.vehicles[0].id },
          data: {
            ...(d.vehicleMake ? { make: d.vehicleMake } : {}),
            ...(d.vehicleModel ? { model: d.vehicleModel } : {}),
            ...(d.vehiclePlate ? { licensePlate: d.vehiclePlate.toUpperCase() } : {}),
            ...(d.vehicleClass ? { class: d.vehicleClass as never } : {}),
            ...(d.vehicleColor ? { color: d.vehicleColor } : {}),
          },
        })]
      : []),
  ]);
  return NextResponse.json({ ok: true });
}
