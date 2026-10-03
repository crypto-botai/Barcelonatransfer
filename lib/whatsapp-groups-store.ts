import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sanitizeGroups, type WaGroup } from "@/lib/whatsapp-groups";

/**
 * Where groups are kept: the newest saved list, as a row in the activity log,
 * the same way the WhatsApp settings are. Each save is its own row, so the
 * history of who changed which group comes free.
 */

const ENTITY = "WhatsAppGroups";

export async function loadGroups(): Promise<WaGroup[]> {
  try {
    const row = await prisma.activityLog.findFirst({
      where: { entity: ENTITY, action: "WA_GROUPS" },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });
    return row ? sanitizeGroups((row.details as { groups?: unknown } | null)?.groups) : [];
  } catch {
    return [];
  }
}

export async function saveGroups(input: unknown, by: string): Promise<WaGroup[]> {
  const groups = sanitizeGroups(input);
  await prisma.activityLog.create({ data: { action: "WA_GROUPS", entity: ENTITY, adminName: by, details: { groups } as unknown as object } });
  return groups;
}

const hash = (text: string) => createHash("sha256").update(text.trim()).digest("hex").slice(0, 24);

/** Was this exact text sent to this group in the last few minutes? Stops a double click sending it twice. */
export async function sentRecently(groupId: string, text: string, withinMs = 10 * 60_000): Promise<boolean> {
  const row = await prisma.activityLog.findFirst({
    where: {
      entity: ENTITY, action: "WA_BROADCAST", entityId: groupId,
      createdAt: { gte: new Date(Date.now() - withinMs) },
      details: { path: ["hash"], equals: hash(text) },
    },
    select: { id: true },
  }).catch(() => null);
  return Boolean(row);
}

export async function recordBroadcast(groupId: string, text: string, by: string, sent: number): Promise<void> {
  await prisma.activityLog.create({
    data: { action: "WA_BROADCAST", entity: ENTITY, entityId: groupId, adminName: by, details: { hash: hash(text), sent } },
  }).catch(() => {});
}
