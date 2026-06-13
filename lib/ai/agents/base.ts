import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isBudgetAvailable, recordSpend } from "@/lib/ai/budget";
import { log, logError } from "@/lib/ai/logger";
import { createAlert, dayDedupeKey } from "@/lib/ai/alerts";

export abstract class BaseAgent {
  abstract readonly name: string;
  abstract readonly description: string;

  protected agentId?: string;
  protected taskId?: string;
  protected taskOutput: Prisma.InputJsonObject = {};

  async getOrCreateRecord() {
    const existing = await prisma.aiAgent.findUnique({ where: { name: this.name } });
    if (existing) { this.agentId = existing.id; return existing; }
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

    // Create task record
    const task = await prisma.aiTask.create({
      data: { agentId: agent.id, status: "QUEUED", input: { trigger: "cron", agent: this.name } },
    });
    this.taskId = task.id;

    // Transition: QUEUED → RUNNING
    await Promise.all([
      prisma.aiTask.update({
        where: { id: task.id },
        data: { status: "RUNNING", startedAt: new Date() },
      }),
      prisma.aiAgent.update({
        where: { id: agent.id },
        data: { status: "RUNNING", lastRunAt: new Date() },
      }),
    ]);

    await log({ agentId: agent.id, taskId: task.id, action: "run_start", message: `${this.name} started` });

    const start = Date.now();

    try {
      await this.execute();

      const duration = Date.now() - start;
      const prevRuns = agent.totalRuns;
      const newRate  = prevRuns === 0 ? 100 : (agent.successRate * prevRuns + 100) / (prevRuns + 1);

      await Promise.all([
        prisma.aiTask.update({
          where: { id: task.id },
          data: {
            status:      "COMPLETED",
            completedAt: new Date(),
            durationMs:  duration,
            output:      this.taskOutput,
          },
        }),
        prisma.aiAgent.update({
          where: { id: agent.id },
          data: {
            status:        "IDLE",
            totalRuns:     { increment: 1 },
            successRate:   newRate,
            avgDurationMs: Math.round((agent.avgDurationMs * prevRuns + duration) / (prevRuns + 1)),
            lastError:     null,
          },
        }),
      ]);

      await log({
        agentId: agent.id, taskId: task.id,
        action: "run_complete",
        message: `${this.name} completed in ${duration}ms`,
        durationMs: duration,
      });
    } catch (err) {
      const duration = Date.now() - start;
      const errMsg   = err instanceof Error ? err.message : String(err);

      await Promise.all([
        prisma.aiTask.update({
          where: { id: task.id },
          data: { status: "FAILED", completedAt: new Date(), durationMs: duration, error: errMsg.slice(0, 1000) },
        }),
        prisma.aiAgent.update({
          where: { id: agent.id },
          data: {
            status:     "ERROR",
            errorCount: { increment: 1 },
            totalRuns:  { increment: 1 },
            lastError:  errMsg.slice(0, 500),
          },
        }),
      ]);

      await logError(agent.id, `${this.name} failed: ${errMsg}`, err);

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

  protected async trackSpend(costCents: number, inputTokens: number, outputTokens: number): Promise<void> {
    await recordSpend(costCents, this.agentId);
    await log({
      agentId:    this.agentId,
      taskId:     this.taskId,
      action:     "api_call",
      level:      "info",
      message:    `${this.name}: ${inputTokens} in / ${outputTokens} out`,
      tokensUsed: inputTokens + outputTokens,
      costCents,
    });
  }

  abstract execute(): Promise<void>;
}
