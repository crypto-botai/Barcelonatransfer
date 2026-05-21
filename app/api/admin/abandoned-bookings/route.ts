import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page  = parseInt(req.nextUrl.searchParams.get("page")  ?? "1");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.abandonedBooking.findMany({
      orderBy: { createdAt: "desc" },
      skip, take: limit,
      include: { coupon: { select: { code: true, usedAt: true, expiresAt: true, discountPct: true } } },
    }),
    prisma.abandonedBooking.count(),
  ]);

  const stats = await prisma.abandonedBooking.aggregate({
    _count: { id: true },
    where: { convertedAt: { not: null } },
  });

  return NextResponse.json({ items, total, converted: stats._count.id });
}
