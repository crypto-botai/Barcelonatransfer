import { prisma } from "@/lib/prisma";
import { isBudgetAvailable } from "@/lib/ai/budget";
import { log } from "@/lib/ai/logger";
import { pruneOldLogs } from "@/lib/ai/logger";
import { pruneMemory } from "@/lib/ai/memory";
import { BookingAgent } from "@/lib/ai/agents/booking";

export async function runOrchestrator(): Promise<{ ran: string[]; skipped: string[] }> {
  const ran: string[]     = [];
  const skipped: string[] = [];

  const start = Date.now();
  await log({ action: "orchestrator_start", message: "Master orchestrator running" });

  if (!(await isBudgetAvailable())) {
    await log({ action: "orchestrator_skip", level: "warn", message: "Budget exhausted — all agents skipped" });
    return { ran: [], skipped: ["all"] };
  }

  // Booking agent — runs daily
  try {
    const agent = new BookingAgent();
    await agent.run();
    ran.push("booking");
  } catch (e) {
    skipped.push("booking");
    console.error("[orchestrator] booking agent failed:", e);
  }

  // Daily housekeeping
  const pruned = await pruneOldLogs(30);
  await pruneMemory(90);

  await log({
    action:     "orchestrator_done",
    message:    `Orchestrator done in ${Date.now() - start}ms. Pruned ${pruned} old logs.`,
    durationMs: Date.now() - start,
  });

  // Mark all enabled agents that haven't run today as IDLE
  await prisma.aiAgent.updateMany({
    where: { status: "RUNNING" },
    data:  { status: "IDLE" },
  });

  return { ran, skipped };
}
