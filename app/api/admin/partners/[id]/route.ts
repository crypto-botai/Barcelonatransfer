import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { partnerBalance } from "@/lib/partner";

async function requireAdmin() {
  const s = await getServerSession(authOptions);
  const u = s?.user as { role?: string } | undefined;
  return Boolean(s && u?.role === "ADMIN");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const partner = await prisma.fleetPartner.findUnique({
    where: { id },
    include: {
      drivers: { include: { user: { select: { name: true, email: true, phone: true } }, vehicles: { take: 1 } }, orderBy: { createdAt: "asc" } },
      withdrawals: { orderBy: { createdAt: "desc" } },
      bookings: {
        where: { isDeleted: false },
        orderBy: { pickupDatetime: "desc" },
        take: 100,
        select: {
          id: true, confirmationCode: true, status: true, pickupAddress: true, dropoffAddress: true,
          pickupDatetime: true, totalAmount: true, partnerPayout: true, driverAmount: true,
          partnerAssignedAt: true, partnerDispatchedAt: true,
          driver: { select: { user: { select: { name: true } }, vehicles: { take: 1, select: { licensePlate: true } } } },
        },
      },
    },
  });
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const balance = await partnerBalance(id);
  return NextResponse.json({ ...partner, balance });
}

const patchSchema = z.object({
  name:        z.string().min(2).optional(),
  contactName: z.string().min(2).optional(),
  phone:       z.string().min(6).optional(),
  taxId:       z.string().nullable().optional(),
  address:     z.string().nullable().optional(),
  notes:       z.string().nullable().optional(),
  active:      z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  const partner = await prisma.fleetPartner.update({ where: { id }, data: parsed.data });
  return NextResponse.json(partner);
}
