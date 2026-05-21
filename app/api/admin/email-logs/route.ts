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
  const type  = req.nextUrl.searchParams.get("type") ?? undefined;
  const skip  = (page - 1) * limit;

  const where = type ? { type } : {};

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: limit,
    }),
    prisma.emailLog.count({ where }),
  ]);

  const typeCounts = await prisma.emailLog.groupBy({
    by: ["type"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  return NextResponse.json({ logs, total, typeCounts });
}
