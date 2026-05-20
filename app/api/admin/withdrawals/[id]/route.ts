import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const user    = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await req.json() as { status: string };
  const withdrawal = await prisma.withdrawal.update({
    where: { id },
    data:  { status: status as "PENDING" | "COMPLETED" | "TRANSFERRED" },
  });

  return NextResponse.json(withdrawal);
}
