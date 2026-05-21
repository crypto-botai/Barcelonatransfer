import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

async function requireAdmin() {
  const s = await getServerSession(authOptions);
  return (s?.user as { role?: string })?.role === "ADMIN";
}

const schema = z.object({
  isVip:        z.boolean().optional(),
  isBlacklisted: z.boolean().optional(),
  notes:        z.string().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      customerProfile: true,
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, confirmationCode: true, pickupAddress: true, dropoffAddress: true,
          pickupDatetime: true, totalAmount: true, status: true, paymentStatus: true,
          vehicleClass: true, createdAt: true,
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalSpent = user.bookings.filter((b) => b.paymentStatus === "PAID").reduce((s, b) => s + b.totalAmount, 0);
  return NextResponse.json({ ...user, totalSpent });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = schema.parse(await req.json());
  const profile = await prisma.customerProfile.upsert({
    where:  { userId: id },
    update: {
      ...(body.isVip         !== undefined ? { isVip: body.isVip, vipSince: body.isVip ? new Date() : null } : {}),
      ...(body.isBlacklisted !== undefined ? { isBlacklisted: body.isBlacklisted } : {}),
      ...(body.notes         !== undefined ? { notes: body.notes } : {}),
    },
    create: {
      userId:        id,
      isVip:         body.isVip         ?? false,
      isBlacklisted: body.isBlacklisted ?? false,
      notes:         body.notes,
      vipSince:      body.isVip ? new Date() : null,
    },
  });
  return NextResponse.json(profile);
}
