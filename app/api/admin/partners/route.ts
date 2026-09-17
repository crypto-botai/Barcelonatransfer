import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPartner } from "@/lib/partner";

async function requireAdmin() {
  const s = await getServerSession(authOptions);
  const u = s?.user as { role?: string; id?: string; name?: string } | undefined;
  return s && u?.role === "ADMIN" ? u : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partners = await prisma.fleetPartner.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { drivers: true, bookings: true, withdrawals: { where: { status: "PENDING" } } } },
    },
  });
  // Open jobs and money earned, per company, in one pass each.
  const [open, earned] = await Promise.all([
    prisma.booking.groupBy({
      by: ["partnerId"],
      where: { partnerId: { not: null }, isDeleted: false, status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] } },
      _count: true,
    }),
    prisma.booking.groupBy({
      by: ["partnerId"],
      where: { partnerId: { not: null }, isDeleted: false, status: "COMPLETED" },
      _sum: { partnerPayout: true },
    }),
  ]);
  const openMap   = Object.fromEntries(open.map((o) => [o.partnerId, o._count]));
  const earnedMap = Object.fromEntries(earned.map((o) => [o.partnerId, o._sum.partnerPayout ?? 0]));
  return NextResponse.json(partners.map((p) => ({
    ...p,
    openJobs:    openMap[p.id] ?? 0,
    totalEarned: earnedMap[p.id] ?? 0,
  })));
}

const createSchema = z.object({
  name:        z.string().min(2),
  contactName: z.string().min(2),
  email:       z.string().email(),
  phone:       z.string().min(6),
  taxId:       z.string().optional(),
  address:     z.string().optional(),
  notes:       z.string().optional(),
  convertExisting: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  try {
    const partner = await createPartner(parsed.data);
    await prisma.activityLog.create({
      data: { adminId: admin.id ?? "admin", adminName: admin.name ?? "Admin", action: "CREATE", entity: "FLEET_PARTNER", entityId: partner.id, details: { name: partner.name } as never },
    }).catch(() => {});
    return NextResponse.json(partner, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create partner";
    // The email is already an account: the UI offers to convert it.
    if (msg === "EXISTS") return NextResponse.json({ error: "That email already has an account", exists: true }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
