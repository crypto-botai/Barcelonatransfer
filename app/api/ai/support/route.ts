import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function adminOnly() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);
  const escalatedOnly = searchParams.get("escalated") === "true";

  const where = escalatedOnly ? { escalated: true } : {};

  const [total, logs] = await Promise.all([
    prisma.conversationLog.count({ where }),
    prisma.conversationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
}
