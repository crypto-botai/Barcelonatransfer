import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company-facts";

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getOrCreateBudgetConfig() {
  const existing = await prisma.aiBudgetConfig.findFirst();
  if (existing) return existing;
  return prisma.aiBudgetConfig.create({
    data: {
      globalMonthlyBudgetCents: 2000,
      globalKillSwitch: false,
      alertAt50: true,
      alertAt80: true,
      alertAt100: true,
      quietHoursStart: 23,
      quietHoursEnd: 8,
      alertEmail: process.env.ADMIN_EMAIL ?? COMPANY.email,
    },
  });
}

export async function getMonthlySpendCents(): Promise<number> {
  const agg = await prisma.aiLog.aggregate({
    where: { createdAt: { gte: startOfMonth() }, costCents: { gt: 0 } },
    _sum: { costCents: true },
  });
  return agg._sum.costCents ?? 0;
}

export async function isBudgetAvailable(): Promise<boolean> {
  const config = await getOrCreateBudgetConfig();
  if (config.globalKillSwitch) return false;
  const spent = await getMonthlySpendCents();
  return spent < config.globalMonthlyBudgetCents;
}

export async function recordSpend(costCents: number, agentId?: string): Promise<void> {
  if (agentId) {
    await prisma.aiAgent
      .update({ where: { id: agentId }, data: { spentCents: { increment: costCents } } })
      .catch(() => {});
  }

  const config = await getOrCreateBudgetConfig();
  const spent = await getMonthlySpendCents();
  const totalAfter = spent + costCents;
  const pct = (totalAfter / config.globalMonthlyBudgetCents) * 100;

  const thresholds = [
    { pct: 100, enabled: config.alertAt100, sev: "CRITICAL" as const },
    { pct: 80,  enabled: config.alertAt80,  sev: "WARNING"  as const },
    { pct: 50,  enabled: config.alertAt50,  sev: "INFO"     as const },
  ];

  for (const t of thresholds) {
    if (pct >= t.pct && spent < (t.pct / 100) * config.globalMonthlyBudgetCents && t.enabled) {
      const hour = new Date().toISOString().slice(0, 13);
      await prisma.aiAlert
        .upsert({
          where: { dedupeKey: `budget_${t.pct}_${hour}` },
          update: {},
          create: {
            severity: t.sev,
            title: `AI Budget ${t.pct}% Used`,
            message: `Monthly AI spend: €${(totalAfter / 100).toFixed(2)} of €${(config.globalMonthlyBudgetCents / 100).toFixed(2)}.${pct >= 100 ? " All agents auto-paused." : ""}`,
            channel: "dashboard",
            dedupeKey: `budget_${t.pct}_${hour}`,
          },
        })
        .catch(() => {});
    }
  }

  if (pct >= 100) {
    await prisma.aiBudgetConfig
      .updateMany({ data: { globalKillSwitch: true } })
      .catch(() => {});
  }
}
