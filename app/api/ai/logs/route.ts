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
  const agentId = searchParams.get("agentId") ?? undefined;
  const level   = searchParams.get("level") ?? undefined;
  const query   = searchParams.get("query") ?? searchParams.get("q") ?? undefined;
  const page    = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit   = Math.min(Number(searchParams.get("limit") ?? "40"), 500);
  const csv     = searchParams.get("format") === "csv";

  const where = {
    ...(agentId ? { agentId } : {}),
    ...(level   ? { level }   : {}),
    ...(query ? { message: { contains: query, mode: "insensitive" as const } } : {}),
  };

  if (csv) {
    const logs = await prisma.aiLog.findMany({
      where, orderBy: { createdAt: "desc" }, take: 5000,
      include: { agent: { select: { name: true } } },
    });
    const header = "timestamp,agent,level,action,message,tokens,costCents,durationMs\n";
    const rows   = logs.map((l) => [
      l.createdAt.toISOString(),
      l.agent?.name ?? "",
      l.level,
      l.action,
      `"${l.message.replace(/"/g, "'")}"`,
      l.tokensUsed,
      l.costCents,
      l.durationMs,
    ].join(",")).join("\n");

    return new Response(header + rows, {
      headers: {
        "Content-Type":        "text/csv",
        "Content-Disposition": "attachment; filename=ai-logs.csv",
      },
    });
  }

  const [total, rawLogs] = await Promise.all([
    prisma.aiLog.count({ where }),
    prisma.aiLog.findMany({
      where, orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit, take: limit,
      include: { agent: { select: { name: true } } },
    }),
  ]);

  const logs = rawLogs.map((l) => ({ ...l, agentName: l.agent?.name ?? "unknown" }));

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
}
