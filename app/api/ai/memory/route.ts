import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function adminOnly() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  return session && user?.role === "ADMIN";
}

// GET /api/ai/memory?agentId=&type=&page=1&limit=20
export async function GET(req: NextRequest) {
  if (!(await adminOnly())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId") ?? undefined;
  const type    = searchParams.get("type")    ?? undefined;
  const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit   = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const skip    = (page - 1) * limit;

  const where = {
    ...(agentId ? { agentId } : {}),
    ...(type    ? { type: type as "REPORT" | "FINDING" | "METRIC" | "DECISION" | "OBSERVATION" } : {}),
  };

  const [total, memories, agents] = await Promise.all([
    prisma.aiMemory.count({ where }),
    prisma.aiMemory.findMany({
      where,
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.aiAgent.findMany({ select: { id: true, name: true } }),
  ]);

  const agentMap: Record<string, string> = {};
  for (const a of agents) agentMap[a.id] = a.name;

  const enriched = memories.map((m) => ({
    ...m,
    agent: m.agentId ? { name: agentMap[m.agentId] ?? m.agentId } : null,
  }));

  return NextResponse.json({ memories: enriched, total, page, pages: Math.ceil(total / limit) });
}

// DELETE /api/ai/memory  { id }
export async function DELETE(req: NextRequest) {
  if (!(await adminOnly())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.aiMemory.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
