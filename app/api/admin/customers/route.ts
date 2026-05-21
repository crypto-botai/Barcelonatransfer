import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const s = await getServerSession(authOptions);
  return (s?.user as { role?: string })?.role === "ADMIN";
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const search = req.nextUrl.searchParams.get("q") ?? "";
  const filter = req.nextUrl.searchParams.get("filter") ?? "all"; // all, vip, blacklisted, repeat

  const customers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(search ? {
        OR: [
          { name:  { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
      ...(filter === "vip"         ? { customerProfile: { isVip: true } }         : {}),
      ...(filter === "blacklisted" ? { customerProfile: { isBlacklisted: true } } : {}),
    },
    include: {
      customerProfile: true,
      bookings: {
        select: { totalAmount: true, status: true, createdAt: true, paymentStatus: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const enriched = customers.map((c) => {
    const paid       = c.bookings.filter((b) => b.paymentStatus === "PAID");
    const totalSpent = paid.reduce((s, b) => s + b.totalAmount, 0);
    const totalRides = c.bookings.filter((b) => b.status === "COMPLETED").length;
    const lastBooking = c.bookings[0]?.createdAt ?? null;
    return {
      id:           c.id,
      name:         c.name,
      email:        c.email,
      phone:        c.phone,
      createdAt:    c.createdAt,
      totalBookings: c.bookings.length,
      totalRides,
      totalSpent,
      lastBooking,
      isVip:        c.customerProfile?.isVip ?? false,
      isBlacklisted: c.customerProfile?.isBlacklisted ?? false,
      notes:        c.customerProfile?.notes ?? null,
      vipSince:     c.customerProfile?.vipSince ?? null,
    };
  });

  // Apply repeat filter after enrichment
  const result = filter === "repeat" ? enriched.filter((c) => c.totalBookings > 1) : enriched;

  return NextResponse.json({
    customers: result,
    stats: {
      total:      customers.length,
      vip:        enriched.filter((c) => c.isVip).length,
      blacklisted: enriched.filter((c) => c.isBlacklisted).length,
      repeat:     enriched.filter((c) => c.totalBookings > 1).length,
    },
  });
}
