import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const withdrawals = await prisma.withdrawal.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      driver: {
        select: {
          id: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json(withdrawals);
}
