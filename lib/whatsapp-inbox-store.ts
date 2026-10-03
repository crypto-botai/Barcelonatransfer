import { prisma } from "@/lib/prisma";
import {
  WA_ENTITY, buildConversations, buildThread, canReplyFreely,
  type InboundMessage, type StatusUpdate, type LogRow,
} from "@/lib/whatsapp-inbox";

/**
 * Reading and writing the inbox. See lib/whatsapp-inbox.ts for the row shapes.
 */

/** How far back the inbox reads. Older conversations are still in the log. */
const INBOX_LOOKBACK_DAYS = 60;
const MAX_ROWS = 4000;

/** Has this Meta message id already been stored? Meta retries, so it must be safe to see one twice. */
async function alreadyStored(wamid: string, action: "WA_MESSAGE" | "WA_STATUS", status?: string): Promise<boolean> {
  const hit = await prisma.activityLog.findFirst({
    where: {
      action,
      entity: WA_ENTITY,
      AND: [
        { details: { path: ["wamid"], equals: wamid } },
        ...(status ? [{ details: { path: ["status"], equals: status } }] : []),
      ],
    },
    select: { id: true },
  }).catch(() => null);
  return Boolean(hit);
}

export async function recordInbound(m: InboundMessage): Promise<boolean> {
  if (await alreadyStored(m.wamid, "WA_MESSAGE")) return false;
  await prisma.activityLog.create({
    data: {
      action: "WA_MESSAGE",
      entity: WA_ENTITY,
      entityId: m.phone,
      createdAt: m.at,
      details: { dir: "in", wamid: m.wamid, text: m.text, type: m.type, mediaId: m.mediaId, name: m.name },
    },
  });
  return true;
}

export async function recordStatus(s: StatusUpdate): Promise<boolean> {
  if (await alreadyStored(s.wamid, "WA_STATUS", s.status)) return false;
  await prisma.activityLog.create({
    data: {
      action: "WA_STATUS",
      entity: WA_ENTITY,
      entityId: s.phone,
      createdAt: s.at,
      details: { wamid: s.wamid, status: s.status, errorCode: s.errorCode, errorText: s.errorText },
    },
  });
  return true;
}

export async function recordOutbound(o: { phone: string; wamid: string; text: string; by: string }): Promise<void> {
  await prisma.activityLog.create({
    data: {
      action: "WA_MESSAGE",
      entity: WA_ENTITY,
      entityId: o.phone,
      details: { dir: "out", wamid: o.wamid, text: o.text, type: "text", by: o.by },
    },
  });
}

export async function markSeen(phone: string): Promise<void> {
  await prisma.activityLog.create({ data: { action: "WA_SEEN", entity: WA_ENTITY, entityId: phone, details: {} } });
}

async function rowsFor(phone?: string): Promise<LogRow[]> {
  const rows = await prisma.activityLog.findMany({
    where: {
      entity: WA_ENTITY,
      ...(phone ? { entityId: phone } : {}),
      createdAt: { gte: new Date(Date.now() - INBOX_LOOKBACK_DAYS * 86400_000) },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: { action: true, entityId: true, createdAt: true, details: true },
  });
  return rows;
}

export async function loadConversations() {
  return buildConversations(await rowsFor());
}

export async function loadThread(phone: string) {
  const rows = await rowsFor(phone);
  return { messages: buildThread(rows), canReplyFreely: canReplyFreely(rows), rows };
}
