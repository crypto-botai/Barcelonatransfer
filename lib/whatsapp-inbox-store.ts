import { prisma } from "@/lib/prisma";
import { paymentTag, phoneVariants, relevantBooking } from "@/lib/whatsapp-tags";
import {
  WA_ENTITY, buildConversations, buildThread, canReplyFreely, latestInboundId, summarize, windowEndsAt,
  type InboundMessage, type StatusUpdate, type ReactionUpdate, type LogRow,
} from "@/lib/whatsapp-inbox";

/**
 * Reading and writing the inbox. See lib/whatsapp-inbox.ts for the row shapes.
 */

/** How far back the inbox reads. Older conversations are still in the log. */
const INBOX_LOOKBACK_DAYS = 60;
const MAX_ROWS = 4000;

type Action = "WA_MESSAGE" | "WA_STATUS" | "WA_REACTION";

/** Has this Meta id already been stored? Meta retries, so it must be safe to see one twice. */
async function alreadyStored(key: "wamid" | "id", value: string, action: Action, status?: string): Promise<boolean> {
  const hit = await prisma.activityLog.findFirst({
    where: {
      action,
      entity: WA_ENTITY,
      AND: [
        { details: { path: [key], equals: value } },
        ...(status ? [{ details: { path: ["status"], equals: status } }] : []),
      ],
    },
    select: { id: true },
  }).catch(() => null);
  return Boolean(hit);
}

export async function recordInbound(m: InboundMessage): Promise<boolean> {
  if (await alreadyStored("wamid", m.wamid, "WA_MESSAGE")) return false;
  await prisma.activityLog.create({
    data: {
      action: "WA_MESSAGE",
      entity: WA_ENTITY,
      entityId: m.phone,
      createdAt: m.at,
      details: {
        dir: "in", wamid: m.wamid, text: m.text, type: m.type, mediaId: m.mediaId, fileName: m.fileName,
        replyTo: m.replyTo, name: m.name,
      },
    },
  });
  return true;
}

export async function recordStatus(s: StatusUpdate): Promise<boolean> {
  if (await alreadyStored("wamid", s.wamid, "WA_STATUS", s.status)) return false;
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

/** A customer's reaction to one of our messages (or to their own). */
export async function recordReaction(r: ReactionUpdate): Promise<boolean> {
  if (await alreadyStored("id", r.id, "WA_REACTION")) return false;
  await prisma.activityLog.create({
    data: {
      action: "WA_REACTION",
      entity: WA_ENTITY,
      entityId: r.phone,
      createdAt: r.at,
      details: { id: r.id, wamid: r.wamid, emoji: r.emoji, dir: "in" },
    },
  });
  return true;
}

/** The office's reaction to a customer's message. */
export async function recordOutboundReaction(o: { phone: string; wamid: string; emoji: string }): Promise<void> {
  await prisma.activityLog.create({
    data: {
      action: "WA_REACTION",
      entity: WA_ENTITY,
      entityId: o.phone,
      details: { id: `out-${Date.now()}`, wamid: o.wamid, emoji: o.emoji, dir: "out" },
    },
  });
}

export async function recordOutbound(o: {
  phone: string;
  wamid: string;
  text: string;
  by: string;
  type?: string;
  mediaId?: string | null;
  fileName?: string | null;
  replyTo?: string | null;
}): Promise<void> {
  await prisma.activityLog.create({
    data: {
      action: "WA_MESSAGE",
      entity: WA_ENTITY,
      entityId: o.phone,
      details: {
        dir: "out", wamid: o.wamid, text: o.text, type: o.type ?? "text", by: o.by,
        mediaId: o.mediaId ?? null, fileName: o.fileName ?? null, replyTo: o.replyTo ?? null,
      },
    },
  });
}

/**
 * The office has opened this conversation: clears the unread count.
 *
 * Writes only when there is something new to clear. The page asks every few
 * seconds while a chat is open, and a row per ask would bury the log in
 * "seen" entries and make every later read slower.
 *
 * Returns the id of the customer's latest message when something was cleared,
 * so the caller can send the read receipt for it, and null otherwise.
 */
export async function markSeen(phone: string): Promise<string | null> {
  const where = { entity: WA_ENTITY, entityId: phone } as const;
  const [lastIn, lastSeen, lastFlag] = await Promise.all([
    prisma.activityLog.findFirst({
      where: { ...where, action: "WA_MESSAGE", details: { path: ["dir"], equals: "in" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, details: true },
    }),
    prisma.activityLog.findFirst({ where: { ...where, action: "WA_SEEN" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.activityLog.findFirst({
      where: { ...where, action: "WA_FLAG", AND: [{ details: { path: ["kind"], equals: "unread" } }, { details: { path: ["value"], equals: true } }] },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  const seenAt = lastSeen?.createdAt.getTime() ?? 0;
  const newMessage = Boolean(lastIn && lastIn.createdAt.getTime() > seenAt);
  const keptUnread = Boolean(lastFlag && lastFlag.createdAt.getTime() > seenAt);
  if (!newMessage && !keptUnread) return null;
  await prisma.activityLog.create({ data: { action: "WA_SEEN", entity: WA_ENTITY, entityId: phone, details: {} } });
  // A read receipt is only for a real message; clearing a kept-unread mark sends nothing to the customer.
  const id = newMessage ? (lastIn!.details as { wamid?: string } | null)?.wamid : undefined;
  return id ? String(id) : null;
}

/** A star, or "keep as unread". Stored as an event so the newest of each kind wins. */
export async function recordFlag(phone: string, kind: "favorite" | "unread" | "tag", value: boolean | string | null): Promise<void> {
  await prisma.activityLog.create({ data: { action: "WA_FLAG", entity: WA_ENTITY, entityId: phone, details: { kind, value } } });
}

async function rowsFor(phone?: string): Promise<LogRow[]> {
  return prisma.activityLog.findMany({
    where: {
      entity: WA_ENTITY,
      ...(phone ? { entityId: phone } : {}),
      createdAt: { gte: new Date(Date.now() - INBOX_LOOKBACK_DAYS * 86400_000) },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: { action: true, entityId: true, createdAt: true, details: true },
  });
}

/**
 * A token that changes whenever anything in the inbox (or in one chat) does.
 *
 * The page asks for this every few seconds and only fetches the full inbox when
 * it has moved. Two cheap questions are far less work than rebuilding every
 * conversation, and they are asked many times more often.
 *
 * It is the number of rows as well as the newest one. A message carries the
 * time Meta stamped it, which can be older than rows already stored (Meta
 * redelivers after an outage). Judged by newest-row time alone, such a message
 * would change nothing and sit unseen until something newer arrived. Rows are
 * only ever added, so the count always moves.
 */
export async function inboxRevision(phone?: string): Promise<string> {
  const where = { entity: WA_ENTITY, ...(phone ? { entityId: phone } : {}) };
  const [count, latest] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findFirst({ where, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  return count === 0 ? "0" : `${count}-${latest?.createdAt.getTime() ?? 0}`;
}

/**
 * The inbox, optionally with each customer's booking and its payment tag.
 *
 * The bookings are one query for all the numbers at once, matched on the number
 * written either way (with its plus, or bare digits), because bookings were
 * saved from several forms over time.
 */
export async function loadConversations(opts: { withBookings?: boolean } = {}) {
  const conversations = buildConversations(await rowsFor());
  if (opts.withBookings === false || conversations.length === 0) return conversations;

  const bookings = await prisma.booking.findMany({
    where: { isDeleted: false, guestPhone: { in: conversations.flatMap((c) => phoneVariants(c.phone)) } },
    orderBy: { pickupDatetime: "desc" },
    take: 1500,
    select: {
      id: true, confirmationCode: true, status: true, paymentStatus: true, paymentMethod: true, depositAmount: true,
      balanceAmount: true, balancePaidAt: true, totalAmount: true, pickupDatetime: true, guestName: true, guestPhone: true,
    },
  }).catch(() => []);

  const byPhone = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const digits = (b.guestPhone ?? "").replace(/\D/g, "");
    if (!digits) continue;
    byPhone.set(digits, [...(byPhone.get(digits) ?? []), b]);
  }

  const now = new Date();
  return conversations.map((c) => {
    const b = relevantBooking(byPhone.get(c.phone.replace(/\D/g, "")) ?? [], now);
    if (!b) return c;
    const t = paymentTag(b);
    const booking = { code: b.confirmationCode, tag: t.tag, label: t.label, detail: t.detail, pickupAt: new Date(b.pickupDatetime).toISOString(), name: b.guestName };
    // A tag the office chose stays; otherwise the chat shows where the booking's payment stands.
    return { ...c, booking, tag: c.manualTag ? c.tag : { ...t, source: "booking" as const } };
  });
}

export async function loadSummary() {
  // The badge and the alert need counts and a quote, not bookings.
  return summarize(await loadConversations({ withBookings: false }));
}

export async function loadThread(phone: string) {
  const rows = await rowsFor(phone);
  const ends = windowEndsAt(rows);
  return {
    messages: buildThread(rows),
    canReplyFreely: canReplyFreely(rows),
    latestInboundId: latestInboundId(rows),
    windowEndsAt: ends ? new Date(ends).toISOString() : null,
  };
}

/**
 * When we last wrote to this customer, and when we last sent them an automatic
 * reply: what decides whether another one is due.
 */
export async function lastOutboundTimes(phone: string): Promise<{ lastOutboundAt: Date | null; lastAutoAt: Date | null }> {
  const base = { entity: WA_ENTITY, entityId: phone, action: "WA_MESSAGE" } as const;
  const [out, auto] = await Promise.all([
    prisma.activityLog.findFirst({
      where: { ...base, details: { path: ["dir"], equals: "out" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.activityLog.findFirst({
      where: { ...base, AND: [{ details: { path: ["dir"], equals: "out" } }, { details: { path: ["by"], equals: "Auto-reply" } }] },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return { lastOutboundAt: out?.createdAt ?? null, lastAutoAt: auto?.createdAt ?? null };
}
