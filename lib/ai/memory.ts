import { prisma } from "@/lib/prisma";

export type MemoryType = "REPORT" | "DECISION" | "FINDING" | "METRIC" | "OBSERVATION";

interface SaveMemoryOptions {
  agentId?:   string;
  type:       MemoryType;
  title:      string;
  content:    string;
  tags?:      string[];
  importance?: number;
  ttlDays?:   number;
}

export async function saveMemory(opts: SaveMemoryOptions): Promise<void> {
  const expiresAt = opts.ttlDays
    ? new Date(Date.now() + opts.ttlDays * 24 * 60 * 60 * 1000)
    : undefined;

  await prisma.aiMemory
    .create({
      data: {
        agentId:    opts.agentId ?? null,
        type:       opts.type,
        title:      opts.title,
        content:    opts.content,
        tags:       opts.tags ?? [],
        importance: opts.importance ?? 3,
        expiresAt,
      },
    })
    .catch((e) => console.error("[ai/memory] save failed:", e?.message));
}

export async function searchMemory(query: string, agentId?: string, limit = 10) {
  const where = {
    ...(agentId ? { agentId } : {}),
    OR: [
      { title:   { contains: query, mode: "insensitive" as const } },
      { content: { contains: query, mode: "insensitive" as const } },
      { tags:    { has: query } },
    ],
    expiresAt: { equals: null as null | Date }, // only non-expired
  };

  return prisma.aiMemory.findMany({
    where,
    orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

// Delete expired memories and raw logs beyond retention window
export async function pruneMemory(retentionDays = 90): Promise<void> {
  const now = new Date();
  await prisma.aiMemory.deleteMany({ where: { expiresAt: { lt: now } } });

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  await prisma.aiMemory.deleteMany({
    where: { importance: { lte: 1 }, createdAt: { lt: cutoff } },
  });
}
