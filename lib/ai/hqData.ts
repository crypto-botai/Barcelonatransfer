import { prisma } from "@/lib/prisma";

export interface HQAgent {
  id: string;
  name: string;
  description: string;
  status: string;
  isEnabled: boolean;
  successRate: number;
  totalRuns: number;
  errorCount: number;
  avgDurationMs: number;
  lastRunAt: Date | null;
  lastError: string | null;
  memoryCount: number;
  tasksToday: { completed: number; failed: number; running: number; queued: number };
}

export interface HQTask {
  id: string;
  agentId: string;
  status: string;
  durationMs: number | null;
  error: string | null;
  createdAt: Date;
  agent: { name: string } | null;
}

export interface HQLog {
  id: string;
  agentId: string | null;
  action: string;
  message: string;
  level: string;
  tokensUsed: number | null;
  costCents: number | null;
  durationMs: number | null;
  createdAt: Date;
  agent: { name: string } | null;
}

export interface HQAlert {
  id: string;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface HQMetrics {
  bookingsToday: number;
  revenueToday: number;
  totalToday: number;
  completedToday: number;
  failedToday: number;
  alertCount: number;
  avgSuccess: number;
  conversations7d: number;
  kbCount: number;
  agentCount: number;
  agentsRunning: number;
  agentsError: number;
  budgetPct: number;
  spentCents: number;
  budgetCents: number;
}

export interface HQData {
  agents: HQAgent[];
  recentTasks: HQTask[];
  recentLogs: HQLog[];
  activeAlerts: HQAlert[];
  metrics: HQMetrics;
}

export async function getHQData(): Promise<HQData> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const since24h   = new Date(Date.now() - 86_400_000);
  const since7d    = new Date(Date.now() - 7 * 86_400_000);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    agents,
    tasksByAgentStatus,
    recentTasks,
    recentLogs,
    memoryCounts,
    alertCount,
    activeAlerts,
    bookingsToday,
    conversations7d,
    kbCount,
    budgetConfig,
    monthlySpend,
  ] = await Promise.all([
    prisma.aiAgent.findMany({ orderBy: { name: "asc" } }),

    prisma.aiTask.groupBy({
      by: ["agentId", "status"],
      where: { createdAt: { gte: todayStart } },
      _count: true,
    }),

    prisma.aiTask.findMany({
      where: { createdAt: { gte: since24h } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { agent: { select: { name: true } } },
    }),

    prisma.aiLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { agent: { select: { name: true } } },
    }),

    prisma.aiMemory.groupBy({ by: ["agentId"], _count: true }),

    prisma.aiAlert.count({ where: { isRead: false, isDismissed: false } }),

    prisma.aiAlert.findMany({
      where: { isDismissed: false },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, severity: true, title: true, message: true, isRead: true, createdAt: true },
    }),

    prisma.booking.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.conversationLog.count({ where: { createdAt: { gte: since7d } } }),
    prisma.knowledgeBase.count({ where: { isActive: true } }),
    prisma.aiBudgetConfig.findFirst(),
    prisma.aiLog.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { costCents: true } }),
  ]);

  let revenueToday = 0;
  try {
    const r = await prisma.booking.aggregate({
      where: { createdAt: { gte: todayStart }, paymentStatus: "PAID" },
      _sum: { totalAmount: true },
    });
    revenueToday = Number(r._sum.totalAmount ?? 0);
  } catch {}

  // Build enrichment maps
  const memoryMap: Record<string, number> = {};
  for (const m of memoryCounts) if (m.agentId) memoryMap[m.agentId] = m._count;

  const taskMap: Record<string, Record<string, number>> = {};
  for (const t of tasksByAgentStatus) {
    if (!taskMap[t.agentId]) taskMap[t.agentId] = {};
    taskMap[t.agentId][t.status] = t._count;
  }

  const enrichedAgents: HQAgent[] = agents.map(a => ({
    id:           a.id,
    name:         a.name,
    description:  a.description,
    status:       a.status,
    isEnabled:    a.isEnabled,
    successRate:  a.successRate,
    totalRuns:    a.totalRuns,
    errorCount:   a.errorCount,
    avgDurationMs: a.avgDurationMs,
    lastRunAt:    a.lastRunAt,
    lastError:    a.lastError,
    memoryCount:  memoryMap[a.id] ?? 0,
    tasksToday: {
      completed: taskMap[a.id]?.COMPLETED ?? 0,
      failed:    taskMap[a.id]?.FAILED    ?? 0,
      running:   taskMap[a.id]?.RUNNING   ?? 0,
      queued:    taskMap[a.id]?.QUEUED    ?? 0,
    },
  }));

  const totalToday     = enrichedAgents.reduce((s, a) => s + a.tasksToday.completed + a.tasksToday.failed + a.tasksToday.running + a.tasksToday.queued, 0);
  const completedToday = enrichedAgents.reduce((s, a) => s + a.tasksToday.completed, 0);
  const failedToday    = enrichedAgents.reduce((s, a) => s + a.tasksToday.failed, 0);
  const avgSuccess     = agents.length ? Math.round(agents.reduce((s, a) => s + a.successRate, 0) / agents.length) : 0;
  const spentCents     = monthlySpend._sum.costCents ?? 0;
  const budgetCents    = budgetConfig?.globalMonthlyBudgetCents ?? 2000;

  return {
    agents: enrichedAgents,
    recentTasks: recentTasks as HQTask[],
    recentLogs:  recentLogs  as HQLog[],
    activeAlerts: activeAlerts as HQAlert[],
    metrics: {
      bookingsToday,
      revenueToday,
      totalToday,
      completedToday,
      failedToday,
      alertCount,
      avgSuccess,
      conversations7d,
      kbCount,
      agentCount:    agents.length,
      agentsRunning: agents.filter(a => a.status === "RUNNING").length,
      agentsError:   agents.filter(a => a.status === "ERROR").length,
      budgetPct:     Math.min(Math.round((spentCents / budgetCents) * 100), 100),
      spentCents,
      budgetCents,
    },
  };
}
