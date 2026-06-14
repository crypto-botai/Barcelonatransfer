import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function adminOnly() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  return session && user?.role === "ADMIN";
}

// GET /api/ai/activity?since=<ISO>&limit=50
// Returns recent AiLog entries. Client polls this every 3s for the live feed.
export async function GET(req: NextRequest) {
  if (!(await adminOnly())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const since  = searchParams.get("since");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const where = since
    ? { createdAt: { gt: new Date(since) } }
    : {};

  const logs = await prisma.aiLog.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take:    limit,
    include: { agent: { select: { name: true } } },
  });

  const latest = logs[logs.length - 1]?.createdAt ?? null;

  return NextResponse.json({ logs, latest });
}
