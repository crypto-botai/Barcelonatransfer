import { prisma } from "@/lib/prisma";
import { isBudgetAvailable, recordSpend } from "@/lib/ai/budget";
import { log, logError } from "@/lib/ai/logger";
import { createAlert, dayDedupeKey } from "@/lib/ai/alerts";

export abstract class BaseAgent {
  abstract readonly name: string;
  abstract readonly description: string;

  protected agentId?: string;

  async getOrCreateRecord() {
    const existing = await prisma.aiAgent.findUnique({ where: { name: this.name } });
    if (existing) {
      this.agentId = existing.id;
      return existing;
    }
    const created = await prisma.aiAgent.create({
      data: { name: this.name, description: this.description },
    });
    this.agentId = created.id;
    return created;
  }

  async run(): Promise<void> {
    const agent = await this.getOrCreateRecord();
    this.agentId = agent.id;

    if (!agent.isEnabled) {
      await log({ agentId: agent.id, action: "skip", message: `${this.name} is disabled` });
      return;
    }

    if (!(await isBudgetAvailable())) {
      await log({ agentId: agent.id, action: "skip", level: "warn", message: "Budget exhausted — skipping" });
      await prisma.aiAgent.update({ where: { id: agent.id }, data: { status: "PAUSED" } });
      return;
    }

    await prisma.aiAgent.update({ where: { id: agent.id }, data: { status: "RUNNING", lastRunAt: new Date() } });
    const start = Date.now();

    try {
      await this.execute();

      const duration = Date.now() - start;
      const prevRuns = agent.totalRuns;
      const prevRate = agent.successRate;
      const newRate  = prevRuns === 0 ? 100 : (prevRate * prevRuns + 100) / (prevRuns + 1);

      await prisma.aiAgent.update({
        where: { id: agent.id },
        data: {
          status:       "IDLE",
          totalRuns:    { increment: 1 },
          successRate:  newRate,
          avgDurationMs: Math.round((agent.avgDurationMs * prevRuns + duration) / (prevRuns + 1)),
        },
      });

      await log({ agentId: agent.id, action: "run_complete", message: `Completed in ${duration}ms`, durationMs: duration });
    } catch (err) {
      const duration = Date.now() - start;
      const errMsg = err instanceof Error ? err.message : String(err);

      await prisma.aiAgent.update({
        where: { id: agent.id },
        data: { status: "ERROR", errorCount: { increment: 1 }, totalRuns: { increment: 1 } },
      });

      await logError(agent.id, `${this.name} run failed: ${errMsg}`, err);

      await createAlert({
        agentId:   agent.id,
        severity:  "WARNING",
        title:     `Agent Error: ${this.name}`,
        message:   errMsg.slice(0, 500),
        dedupeKey: dayDedupeKey(`agent_error_${agent.id}`),
        sendEmail: true,
      });
    }
  }

  // Record token spend from a Claude call
  protected async trackSpend(costCents: number, inputTokens: number, outputTokens: number): Promise<void> {
    await recordSpend(costCents, this.agentId);
    await log({
      agentId:    this.agentId,
      action:     "api_call",
      level:      "info",
      message:    `Claude: ${inputTokens} in / ${outputTokens} out`,
      tokensUsed: inputTokens + outputTokens,
      costCents,
    });
  }

  abstract execute(): Promise<void>;
}
