import { prisma } from "@/lib/prisma";
import { PARTNER_PUBLIC_NAME, publicSenderName } from "@/lib/trip-chat";
import { notify } from "@/lib/notifications/service";
import type { Prisma, TripSender } from "@prisma/client";

/**
 * Live chat for the mobile apps and the office, on the existing trip chat (the trip_messages table the website already uses).
 *
 * TWO SCOPES, enforced here and nowhere else, so no route can get them wrong:
 *
 *  SHARED   the customer, the assigned chauffeur and the office all see it.
 *  PRIVATE  the office and ONE other person see it. An office message to the customer is invisible to the chauffeur and the other
 *           way round; a customer's or chauffeur's private reply to the office is invisible to the other of them.
 *
 * Privacy is NOT end-to-end: private messages are stored on the company's servers and authorised office staff can read all chats.
 * The apps say so on screen. The dispatching fleet company (website only) sees SHARED messages and nothing private.
 */

export type Party = "CUSTOMER" | "DRIVER" | "ADMIN";

export const MAX_TEXT = 1000;
export const PAGE_DEFAULT = 40;
export const PAGE_MAX = 100;

/** After a ride is completed or cancelled the chat stays open this long (a lost item, a thank-you), then it is read-only for the apps. */
export const CHAT_GRACE_MS = 24 * 3_600_000;
/** Messages and photos are deleted this long after the ride ended (see purgeExpiredChats). */
export const CHAT_RETENTION_DAYS = 180;

export const ATTACHMENT_MAX_BYTES = 1_500_000;
export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** What a message looks like to the person reading it. */
export interface ChatMessageDto {
  id: string;
  /** Who wrote it, for the bubble: "customer", "driver" or "office". The dispatching company is shown as the office. */
  from: "customer" | "driver" | "office";
  name: string;
  text: string;
  attachmentId: string | null;
  /** True for a private message: only the office and one person can see it. */
  private: boolean;
  /** True when the reader wrote it. */
  mine: boolean;
  createdAt: string;
  clientId: string | null;
}

const ROW_SELECT = {
  id: true, sender: true, senderName: true, body: true, createdAt: true, scope: true, toParty: true, clientId: true, attachmentId: true,
} as const;

type Row = Prisma.TripMessageGetPayload<{ select: typeof ROW_SELECT }>;

/** The Prisma filter for what `party` may read. The ONE place the privacy rule is written. */
export function visibleTo(party: Party): Prisma.TripMessageWhereInput {
  if (party === "ADMIN") return {};
  return {
    OR: [
      { scope: "SHARED" },
      // addressed to me by the office, or written by me to the office
      { scope: "PRIVATE", toParty: party },
      { scope: "PRIVATE", sender: party, toParty: "ADMIN" },
    ],
  };
}

/** True when `party` may read this message. Used where a single message is looked at (an attachment); the same rule as visibleTo. */
export function canRead(party: Party, m: { scope: string; sender: TripSender; toParty: TripSender | null }): boolean {
  if (party === "ADMIN") return true;
  if (m.scope === "SHARED") return true;
  return m.toParty === party || (m.sender === party && m.toParty === "ADMIN");
}

export function toDto(m: Row, party: Party): ChatMessageDto {
  const from = m.sender === "CUSTOMER" ? "customer" : m.sender === "DRIVER" ? "driver" : "office";
  return {
    id: m.id,
    from,
    name: from === "office" ? "Elite BCN" : publicSenderName(m.sender, m.senderName),
    text: m.body,
    attachmentId: m.attachmentId,
    private: m.scope === "PRIVATE",
    mine: m.sender === party,
    createdAt: m.createdAt.toISOString(),
    clientId: m.clientId,
  };
}

export interface ChatPage {
  messages: ChatMessageDto[];
  /** True when older messages exist before the first one returned. */
  hasMore: boolean;
}

/**
 * A page of the conversation, oldest first.
 *  - `after`: only messages newer than this time (polling).
 *  - `before`: the page of older messages before this time (scrolling up).
 */
export async function listChat(bookingId: string, party: Party, opts: { after?: string | null; before?: string | null; limit?: number } = {}): Promise<ChatPage> {
  const limit = Math.min(PAGE_MAX, Math.max(1, opts.limit ?? PAGE_DEFAULT));
  const time: Prisma.DateTimeFilter = {};
  const after = opts.after ? new Date(opts.after) : null;
  const before = opts.before ? new Date(opts.before) : null;
  if (after && !Number.isNaN(after.getTime())) time.gt = after;
  if (before && !Number.isNaN(before.getTime())) time.lt = before;
  const where: Prisma.TripMessageWhereInput = { AND: [{ bookingId }, visibleTo(party), Object.keys(time).length ? { createdAt: time } : {}] };

  // Newest `limit + 1` (to know if there is more), then put them back in reading order. Polling asks for everything after a time.
  const rows = await prisma.tripMessage.findMany({ where, orderBy: { createdAt: after ? "asc" : "desc" }, take: limit + 1, select: ROW_SELECT });
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  if (!after) page.reverse();
  return { messages: page.map((r) => toDto(r, party)), hasMore: after ? false : hasMore };
}

export type ChatError = "EMPTY" | "TOO_LONG" | "CLOSED" | "BAD_ATTACHMENT" | "BAD_TARGET";

export class ChatRuleError extends Error {
  constructor(readonly code: ChatError, message: string) {
    super(message);
  }
}

/** Strips control characters and collapses runaway blank lines; keeps emoji and normal punctuation. */
export function cleanText(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export interface ChatContext {
  id: string;
  status: string;
  rideEndedAt: Date | null;
  updatedAt: Date;
  userId: string | null;
  customerName: string;
  driverUserId: string | null;
  driverName: string | null;
}

/** Whether the apps can still send. The office can always write. */
export function chatClosedReason(booking: { status: string; rideEndedAt: Date | null; updatedAt: Date }, now = Date.now()): string | null {
  if (booking.status === "PENDING") return "The chat opens once your ride is confirmed.";
  if (booking.status === "COMPLETED" || booking.status === "CANCELLED" || booking.status === "REFUNDED") {
    const ended = (booking.rideEndedAt ?? booking.updatedAt).getTime();
    if (now - ended > CHAT_GRACE_MS) return "This ride ended more than a day ago, so the chat is closed. Contact Elite BCN if you need help.";
  }
  return null;
}

export interface SendInput {
  /** Chosen by the app for each message; the same value again returns the message already stored instead of making a second one. */
  clientId?: string | null;
  text?: string | null;
  attachmentId?: string | null;
  /** PRIVATE: who it is for. Customers and chauffeurs can only write privately to the office. */
  scope?: "SHARED" | "PRIVATE";
  to?: Party;
  /** The office user who wrote it. */
  adminUserId?: string | null;
  adminName?: string | null;
}

/** Writes one message and tells the other person (without its content). Throws ChatRuleError for a message the rules refuse. */
export async function sendChat(booking: ChatContext, party: Party, input: SendInput, now = Date.now()): Promise<{ message: ChatMessageDto; duplicate: boolean }> {
  const text = cleanText(input.text ?? "");
  if (text.length > MAX_TEXT) throw new ChatRuleError("TOO_LONG", `Messages can be up to ${MAX_TEXT} characters.`);
  if (!text && !input.attachmentId) throw new ChatRuleError("EMPTY", "Write a message first.");
  if (party !== "ADMIN") {
    const closed = chatClosedReason(booking, now);
    if (closed) throw new ChatRuleError("CLOSED", closed);
  }

  const scope = input.scope ?? "SHARED";
  let toParty: TripSender | null = null;
  if (scope === "PRIVATE") {
    // A person can only write privately to the office. The office chooses which person.
    if (party === "ADMIN") {
      if (input.to !== "CUSTOMER" && input.to !== "DRIVER") throw new ChatRuleError("BAD_TARGET", "Choose the customer or the driver.");
      if (input.to === "DRIVER" && !booking.driverUserId) throw new ChatRuleError("BAD_TARGET", "No driver is assigned to this ride yet.");
      toParty = input.to;
    } else {
      toParty = "ADMIN";
    }
  } else if (party === "ADMIN" && !input.to) {
    toParty = null;
  }

  if (input.attachmentId) {
    const att = await prisma.tripChatAttachment.findFirst({ where: { id: input.attachmentId, bookingId: booking.id }, select: { id: true, uploadedBy: true } });
    // Only the sender's own photo for this booking can be attached.
    if (!att || att.uploadedBy !== party) throw new ChatRuleError("BAD_ATTACHMENT", "That photo could not be attached.");
  }

  const clientId = input.clientId ? String(input.clientId).slice(0, 64) : null;
  const sender: TripSender = party;
  if (clientId) {
    const existing = await prisma.tripMessage.findFirst({ where: { bookingId: booking.id, sender, clientId }, select: ROW_SELECT });
    if (existing) return { message: toDto(existing, party), duplicate: true };
  }

  const senderName = party === "ADMIN" ? "Elite BCN" : party === "DRIVER" ? (booking.driverName ?? "Your chauffeur") : booking.customerName;
  let row: Row;
  try {
    row = await prisma.tripMessage.create({
      data: {
        bookingId: booking.id, sender, senderName, body: text, scope, toParty, clientId,
        attachmentId: input.attachmentId ?? null, adminUserId: party === "ADMIN" ? (input.adminUserId ?? null) : null,
      },
      select: ROW_SELECT,
    });
  } catch (e) {
    // Two sends of the same clientId at once: the unique index refuses the second, which is the duplicate protection.
    if (clientId && (e as { code?: string })?.code === "P2002") {
      const again = await prisma.tripMessage.findFirst({ where: { bookingId: booking.id, sender, clientId }, select: ROW_SELECT });
      if (again) return { message: toDto(again, party), duplicate: true };
    }
    throw e;
  }

  await notifyOthers(booking, party, scope, toParty);
  return { message: toDto(row, party), duplicate: false };
}

/**
 * The push for a chat message. It names who wrote and never carries the message: a lock screen must not show a private (or any) chat
 * message. Private and shared look the same on purpose, so a notification does not reveal that a message is private.
 */
async function notifyOthers(booking: ChatContext, from: Party, scope: "SHARED" | "PRIVATE", toParty: TripSender | null): Promise<void> {
  const targets: { userId: string; who: string }[] = [];
  const fromName = from === "ADMIN" ? "Elite BCN" : from === "DRIVER" ? (booking.driverName ?? "Your chauffeur") : booking.customerName;
  const toCustomer = from !== "CUSTOMER" && booking.userId && (scope === "SHARED" || toParty === "CUSTOMER");
  const toDriver = from !== "DRIVER" && booking.driverUserId && (scope === "SHARED" || toParty === "DRIVER");
  if (toCustomer && booking.userId) targets.push({ userId: booking.userId, who: from === "DRIVER" ? (booking.driverName ?? "Your chauffeur") : "Elite BCN" });
  if (toDriver && booking.driverUserId) targets.push({ userId: booking.driverUserId, who: from === "CUSTOMER" ? "Your passenger" : "Elite BCN" });
  void fromName;
  await Promise.all(
    targets.map((t) =>
      notify({ event: "CHAT_MESSAGE", channels: ["push"], userId: t.userId, bookingId: booking.id, vars: { from: t.who } }).catch(() => undefined),
    ),
  );
}

/** Marks everything up to now as read by this person. */
export async function markChatRead(bookingId: string, party: Party, at = new Date()): Promise<void> {
  await prisma.tripChatRead.upsert({
    where: { bookingId_party: { bookingId, party } },
    create: { bookingId, party, readAt: at },
    update: { readAt: at },
  });
}

/** How many messages written by someone else this person has not read, on one booking. */
export async function unreadCount(bookingId: string, party: Party): Promise<number> {
  const read = await prisma.tripChatRead.findUnique({ where: { bookingId_party: { bookingId, party } }, select: { readAt: true } });
  return prisma.tripMessage.count({
    where: { AND: [{ bookingId }, visibleTo(party), { sender: { not: party } }, read ? { createdAt: { gt: read.readAt } } : {}] },
  });
}

/** Unread counts for many bookings at once (the badge on a ride list). Zero counts are left out. */
export async function unreadByBooking(bookingIds: string[], party: Party): Promise<Record<string, number>> {
  if (bookingIds.length === 0) return {};
  const [reads, messages] = await Promise.all([
    prisma.tripChatRead.findMany({ where: { bookingId: { in: bookingIds }, party }, select: { bookingId: true, readAt: true } }),
    prisma.tripMessage.findMany({
      where: { AND: [{ bookingId: { in: bookingIds } }, visibleTo(party), { sender: { not: party } }] },
      select: { bookingId: true, createdAt: true },
      take: 5000,
    }),
  ]);
  const readAt = new Map(reads.map((r) => [r.bookingId, r.readAt.getTime()]));
  const out: Record<string, number> = {};
  for (const m of messages) {
    if (m.createdAt.getTime() > (readAt.get(m.bookingId) ?? 0)) out[m.bookingId] = (out[m.bookingId] ?? 0) + 1;
  }
  return out;
}

/** The ride and the two people on it, as the chat needs them. Null when the booking does not exist. */
export async function chatContext(bookingId: string): Promise<ChatContext | null> {
  const b = await prisma.booking.findFirst({
    where: { id: bookingId, isDeleted: false },
    select: {
      id: true, status: true, rideEndedAt: true, updatedAt: true, userId: true, guestName: true,
      user: { select: { name: true } },
      driver: { select: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!b) return null;
  return {
    id: b.id, status: b.status, rideEndedAt: b.rideEndedAt, updatedAt: b.updatedAt, userId: b.userId,
    customerName: b.guestName ?? b.user?.name ?? "Customer",
    driverUserId: b.driver?.user.id ?? null,
    driverName: b.driver?.user.name ?? null,
  };
}

// ─── photos ───────────────────────────────────────────────────────────────────

/** The type of an image from its first bytes (never from what the sender says it is). */
export function sniffImage(buf: Uint8Array): (typeof ATTACHMENT_TYPES)[number] | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length > 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return null;
}

/** Stores a photo for one booking after checking its size and its real type. Returns its id. */
export async function saveAttachment(bookingId: string, party: Party, base64: string): Promise<string> {
  const clean = base64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new ChatRuleError("BAD_ATTACHMENT", "That photo could not be read.");
  const bytes = Buffer.from(clean, "base64");
  if (bytes.length === 0) throw new ChatRuleError("BAD_ATTACHMENT", "That photo could not be read.");
  if (bytes.length > ATTACHMENT_MAX_BYTES) throw new ChatRuleError("BAD_ATTACHMENT", "That photo is too large. Photos can be up to 1.5 MB.");
  const mime = sniffImage(bytes);
  if (!mime) throw new ChatRuleError("BAD_ATTACHMENT", "Only JPEG, PNG or WebP photos can be sent.");
  const row = await prisma.tripChatAttachment.create({ data: { bookingId, uploadedBy: party, mime, size: bytes.length, data: bytes }, select: { id: true } });
  return row.id;
}

/** A photo, only if this person may read the message it belongs to (or it is not attached to one yet and they uploaded it). */
export async function readAttachment(bookingId: string, attachmentId: string, party: Party): Promise<{ mime: string; data: Uint8Array } | null> {
  const att = await prisma.tripChatAttachment.findFirst({ where: { id: attachmentId, bookingId }, select: { mime: true, data: true, uploadedBy: true } });
  if (!att) return null;
  const msg = await prisma.tripMessage.findFirst({ where: { bookingId, attachmentId }, select: { scope: true, sender: true, toParty: true } });
  if (msg) return canRead(party, msg) ? { mime: att.mime, data: att.data } : null;
  return party === "ADMIN" || att.uploadedBy === party ? { mime: att.mime, data: att.data } : null;
}

// ─── retention ────────────────────────────────────────────────────────────────

/**
 * Deletes the chat (messages and photos) of rides that ended more than CHAT_RETENTION_DAYS ago. Not called by anything yet: wire it
 * to the daily cron once the retention period is agreed. Returns what it removed. Bookings themselves are never touched.
 */
export async function purgeExpiredChats(now = Date.now()): Promise<{ messages: number; attachments: number }> {
  const cutoff = new Date(now - CHAT_RETENTION_DAYS * 86_400_000);
  const ended = { status: { in: ["COMPLETED", "CANCELLED", "REFUNDED"] as ("COMPLETED" | "CANCELLED" | "REFUNDED")[] }, OR: [{ rideEndedAt: { lt: cutoff } }, { rideEndedAt: null, updatedAt: { lt: cutoff } }] };
  const [messages, attachments] = await Promise.all([
    prisma.tripMessage.deleteMany({ where: { booking: ended } }),
    prisma.tripChatAttachment.deleteMany({ where: { booking: ended } }),
  ]);
  return { messages: messages.count, attachments: attachments.count };
}

export { PARTNER_PUBLIC_NAME };
