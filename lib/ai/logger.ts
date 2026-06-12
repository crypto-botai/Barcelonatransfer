import { prisma } from "@/lib/prisma";

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  agentId?:   string;
  taskId?:    string;
  action:     string;
  level?:     LogLevel;
  message:    string;
  metadata?:  Record<string, unknown>;
  tokensUsed?: number;
  costCents?:  number;
  durationMs?: number;
}

export async function log(entry: LogEntry): Promise<void> {
  await prisma.aiLog
    .create({
      data: {
        agentId:    entry.agentId   ?? null,
        taskId:     entry.taskId    ?? null,
        action:     entry.action,
        level:      entry.level     ?? "info",
        message:    entry.message,
        metadata:   entry.metadata  ?? undefined,
        tokensUsed: entry.tokensUsed ?? 0,
        costCents:  entry.costCents  ?? 0,
        durationMs: entry.durationMs ?? 0,
      },
    })
    .catch((e) => console.error("[ai/logger] failed:", e?.message));
}

export async function logError(agentId: string | undefined, message: string, err?: unknown): Promise<void> {
  await log({
    agentId,
    action:  "error",
    level:   "error",
    message,
    metadata: err instanceof Error ? { error: err.message, stack: err.stack?.slice(0, 500) } : { raw: String(err) },
  });
}

// Prune logs older than retentionDays (keep summaries, delete raw rows)
export async function pruneOldLogs(retentionDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.aiLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}
