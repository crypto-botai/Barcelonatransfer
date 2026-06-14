import { prisma } from "@/lib/prisma";
import { isBudgetAvailable } from "@/lib/ai/budget";
import { log } from "@/lib/ai/logger";
import { pruneOldLogs } from "@/lib/ai/logger";
import { pruneMemory } from "@/lib/ai/memory";
import { BookingAgent }   from "@/lib/ai/agents/booking";
import { HealthAgent }    from "@/lib/ai/agents/health";
import { SeoAgent }       from "@/lib/ai/agents/seo";
import { AnalyticsAgent } from "@/lib/ai/agents/analytics";
import { MarketingAgent } from "@/lib/ai/agents/marketing";
import { KnowledgeAgent } from "@/lib/ai/agents/knowledge";

// ─── Run intervals (hours between eligible runs) ─────────────────────────────
// Edit these numbers to change how often each agent runs.
const RUN_INTERVALS: Record<string, number> = {
  booking:   20,   // every ~day
  health:    20,   // every ~day
  analytics: 20,   // every ~day
  marketing: 48,   // every 2 days (avoid queue spam)
  knowledge: 48,   // every 2 days
  seo:       68,   // every ~3 days
};

// How many hours without a run before marking as WARNING
const STALE_THRESHOLDS: Record<string, number> = {
  booking:   26,
  health:    26,
  analytics: 26,
  marketing: 56,
  knowledge: 56,
  seo:       76,
};

function hoursSince(date: Date | null): number {
  if (!date) return Infinity;
  return (Date.now() - date.getTime()) / 3_600_000;
}

export async function runOrchestrator(): Promise<{ ran: string[]; skipped: string[] }> {
  const ran: string[]     = [];
  const skipped: string[] = [];
  const start = Date.now();

  await log({ action: "orchestrator_start", message: "AI Director starting — coordinating all agents" });

  if (!(await isBudgetAvailable())) {
    await log({ action: "orchestrator_skip", level: "warn", message: "Budget exhausted — all agents skipped" });
    return { ran: [], skipped: ["all"] };
  }

  // Fetch all agent records to check last run times
  const agentRecords = await prisma.aiAgent.findMany({
    select: { name: true, lastRunAt: true, isEnabled: true },
  });
  const lastRunMap: Record<string, Date | null> = {};
  for (const a of agentRecords) lastRunMap[a.name] = a.lastRunAt;

  // ─── Agent roster ──────────────────────────────────────────────────────────
  // Add new agents here. Order matters — higher-priority agents run first.
  const agents: Array<{ name: string; agent: { run(): Promise<void> }; interval: number }> = [
    { name: "booking",   agent: new BookingAgent(),   interval: RUN_INTERVALS.booking   },
    { name: "health",    agent: new HealthAgent(),    interval: RUN_INTERVALS.health    },
    { name: "analytics", agent: new AnalyticsAgent(), interval: RUN_INTERVALS.analytics },
    { name: "knowledge", agent: new KnowledgeAgent(), interval: RUN_INTERVALS.knowledge },
    { name: "marketing", agent: new MarketingAgent(), interval: RUN_INTERVALS.marketing },
    { name: "seo",       agent: new SeoAgent(),       interval: RUN_INTERVALS.seo       },
  ];

  for (const { name, agent, interval } of agents) {
    const hours = hoursSince(lastRunMap[name] ?? null);

    if (hours < interval) {
      await log({
        action:  "orchestrator_skip_agent",
        message: `${name} last ran ${hours.toFixed(1)}h ago — next run in ${(interval - hours).toFixed(1)}h`,
      });
      skipped.push(name);
      continue;
    }

    await log({ action: "orchestrator_dispatch", message: `Dispatching ${name} (last ran ${hours === Infinity ? "never" : `${hours.toFixed(1)}h ago`})` });

    try {
      await agent.run();
      ran.push(name);
    } catch (e) {
      console.error(`[orchestrator] ${name} threw:`, e);
      skipped.push(name);
    }
  }

  // ─── Housekeeping ──────────────────────────────────────────────────────────
  const pruned = await pruneOldLogs(30);
  await pruneMemory(90);

  // Mark stale agents as WARNING based on actual last-run data
  const freshAgents = await prisma.aiAgent.findMany({ select: { id: true, name: true, status: true, lastRunAt: true } });
  for (const a of freshAgents) {
    const threshold = STALE_THRESHOLDS[a.name];
    if (!threshold) continue;
    const hours = hoursSince(a.lastRunAt);
    if (hours > threshold && a.status === "IDLE") {
      await prisma.aiAgent.update({ where: { id: a.id }, data: { status: "WARNING" } });
      await log({
        agentId: a.id,
        action:  "stale_detected",
        level:   "warn",
        message: `${a.name} has not run in ${hours.toFixed(1)}h — marked WARNING`,
      });
    }
  }

  const totalMs = Date.now() - start;
  await log({
    action:     "orchestrator_done",
    message:    `Director done in ${(totalMs / 1000).toFixed(1)}s | ran: [${ran.join(", ")}] | skipped: [${skipped.join(", ")}] | pruned ${pruned} old logs`,
    durationMs: totalMs,
  });

  return { ran, skipped };
}
