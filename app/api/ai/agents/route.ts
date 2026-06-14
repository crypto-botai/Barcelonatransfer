import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

async function adminOnly() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agents = await prisma.aiAgent.findMany({
    orderBy: { name: "asc" },
    include: {
      tasks: {
        orderBy: { createdAt: "desc" },
        take:    8,
        select:  { id: true, status: true, durationMs: true, completedAt: true, error: true, createdAt: true },
      },
    },
  });

  // Attach memory count per agent
  const memoryCounts = await prisma.aiMemory.groupBy({
    by:   ["agentId"],
    _count: true,
  });
  const memMap: Record<string, number> = {};
  for (const m of memoryCounts) if (m.agentId) memMap[m.agentId] = m._count;

  const enriched = agents.map((a) => ({
    ...a,
    memoryCount: memMap[a.id] ?? 0,
  }));

  return NextResponse.json({ agents: enriched });
}

const toggleSchema = z.object({
  id:        z.string(),
  isEnabled: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: "Invalid" }, { status: 401 });

  const body = toggleSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const agent = await prisma.aiAgent.update({
    where: { id: body.data.id },
    data:  { isEnabled: body.data.isEnabled, status: body.data.isEnabled ? "IDLE" : "PAUSED" },
  });
  return NextResponse.json(agent);
}
