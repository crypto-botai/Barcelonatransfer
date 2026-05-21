import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [coupons, total, used, expired, active] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.coupon.count(),
    prisma.coupon.count({ where: { usedAt: { not: null } } }),
    prisma.coupon.count({ where: { expiresAt: { lt: new Date() }, usedAt: null } }),
    prisma.coupon.count({ where: { isActive: true, expiresAt: { gt: new Date() }, usedAt: null } }),
  ]);

  return NextResponse.json({ coupons, stats: { total, used, expired, active } });
}
