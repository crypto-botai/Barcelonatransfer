import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateBudgetConfig, getMonthlySpendCents } from "@/lib/ai/budget";
import { z } from "zod";

async function adminOnly() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return session;
}

function startOfMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

export async function GET() {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await getOrCreateBudgetConfig();
  const spentCents = await getMonthlySpendCents();
  const budgetPct = Math.min(Math.round((spentCents / config.globalMonthlyBudgetCents) * 100), 100);

  const monthlyAgg = await prisma.aiLog.aggregate({
    where: { createdAt: { gte: startOfMonth() } },
    _sum: { tokensUsed: true },
  });

  const byAgent = await prisma.aiLog.groupBy({
    by: ["agentId"],
    where: { createdAt: { gte: startOfMonth() } },
    _sum: { costCents: true, tokensUsed: true },
    _count: { id: true },
  });

  const agentIds = byAgent.map((r) => r.agentId).filter(Boolean) as string[];
  const agents   = agentIds.length
    ? await prisma.aiAgent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } })
    : [];
  const nameMap  = Object.fromEntries(agents.map((a) => [a.id, a.name]));

  const breakdown = byAgent.map((r) => ({
    agentName:  nameMap[r.agentId ?? ""] ?? "unknown",
    costCents:  r._sum.costCents ?? 0,
    tokensUsed: r._sum.tokensUsed ?? 0,
    calls:      r._count.id,
  })).sort((a, b) => b.costCents - a.costCents);

  return NextResponse.json({
    config,
    spentCents,
    budgetPct,
    tokensUsed: monthlyAgg._sum.tokensUsed ?? 0,
    breakdown,
  });
}

const updateSchema = z.object({
  globalMonthlyBudgetCents: z.number().int().min(100).max(100000).optional(),
  globalKillSwitch:         z.boolean().optional(),
  alertAt50:                z.boolean().optional(),
  alertAt80:                z.boolean().optional(),
  alertAt100:               z.boolean().optional(),
  quietHoursStart:          z.number().int().min(0).max(23).optional(),
  quietHoursEnd:            z.number().int().min(0).max(23).optional(),
  alertEmail:               z.string().email().optional(),
});

export async function PATCH(req: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: body.error.errors[0].message }, { status: 400 });

  const existing = await getOrCreateBudgetConfig();
  const updated  = await prisma.aiBudgetConfig.update({ where: { id: existing.id }, data: body.data });
  return NextResponse.json(updated);
}
