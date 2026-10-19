import { prisma } from "@/lib/prisma";
import { CHAT_GRACE_MS, PAGE_DEFAULT, PAGE_MAX, chatClosedReason, toDto, type ChatMessageDto } from "@/lib/chat";
import type { Prisma } from "@prisma/client";

/**
 * The office's view of live chat: every conversation, with private messages marked and addressed.
 * Authorisation (ADMIN only) is the caller's job and is done in each /api/admin/chat route.
 */

export type AdminChatFilter = "all" | "active" | "unread" | "completed" | "support";

export interface AdminChatMessage extends ChatMessageDto {
  /** For a private message: who it is between the office and ("customer" or "driver"). Null for a shared one. */
  withParty: "customer" | "driver" | null;
  /** The office user who wrote it, for the audit view. */
  adminUserId: string | null;
}

export interface AdminConversation {
  bookingId: string;
  code: string;
  customer: string;
  driver: string | null;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupAt: string;
  lastAt: string | null;
  lastPreview: string | null;
  lastPrivate: boolean;
  unread: number;
  /** A customer or driver wrote to the office privately and no office reply followed. */
  needsReply: boolean;
}

const ACTIVE = ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] as const;
const ENDED = ["COMPLETED", "CANCELLED", "REFUNDED"] as const;

const MSG_SELECT = {
  id: true, sender: true, senderName: true, body: true, createdAt: true, scope: true, toParty: true, clientId: true, attachmentId: true, adminUserId: true,
} as const;

export function adminDto(m: Prisma.TripMessageGetPayload<{ select: typeof MSG_SELECT }>): AdminChatMessage {
  const withParty = m.scope !== "PRIVATE" ? null : m.sender === "ADMIN" ? (m.toParty === "DRIVER" ? "driver" : "customer") : m.sender === "DRIVER" ? "driver" : "customer";
  return { ...toDto(m, "ADMIN"), withParty, adminUserId: m.adminUserId };
}

const STATUSES = ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUNDED"] as const;

/** A search word that names a ride status ("completed", "in progress") also matches by status. */
function statusMatches(q: string): Prisma.BookingWhereInput[] {
  const key = q.toUpperCase().replace(/\s+/g, "_");
  const hit = STATUSES.find((s) => s === key);
  return hit ? [{ status: hit }] : [];
}

export async function listConversations(opts: { q?: string; filter?: AdminChatFilter; limit?: number }): Promise<AdminConversation[]> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const q = (opts.q ?? "").trim().slice(0, 80);
  const filter = opts.filter ?? "all";

  const and: Prisma.BookingWhereInput[] = [{ isDeleted: false }];
  if (filter === "active") and.push({ status: { in: [...ACTIVE] } });
  if (filter === "completed") and.push({ status: { in: [...ENDED] } });
  if (filter === "support") and.push({ messages: { some: { scope: "PRIVATE", toParty: "ADMIN" } } });
  if (q) {
    and.push({
      OR: [
        { confirmationCode: { contains: q, mode: "insensitive" } },
        { guestName: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { driver: { user: { name: { contains: q, mode: "insensitive" } } } },
        ...statusMatches(q),
      ],
    });
  }
  // Only rides that have a conversation.
  and.push({ messages: { some: {} } });

  const rows = await prisma.booking.findMany({
    where: { AND: and },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, confirmationCode: true, status: true, guestName: true, pickupAddress: true, dropoffAddress: true, pickupDatetime: true,
      user: { select: { name: true } },
      driver: { select: { user: { select: { name: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true, scope: true, attachmentId: true } },
      chatReads: { where: { party: "ADMIN" }, select: { readAt: true } },
    },
  });
  const ids = rows.map((r) => r.id);
  const [incoming, privateIn, privateOut] = await Promise.all([
    prisma.tripMessage.findMany({ where: { bookingId: { in: ids }, sender: { not: "ADMIN" } }, select: { bookingId: true, createdAt: true }, take: 5000 }),
    prisma.tripMessage.groupBy({ by: ["bookingId", "sender"], where: { bookingId: { in: ids }, scope: "PRIVATE", toParty: "ADMIN" }, _max: { createdAt: true } }),
    prisma.tripMessage.groupBy({ by: ["bookingId", "toParty"], where: { bookingId: { in: ids }, scope: "PRIVATE", sender: "ADMIN" }, _max: { createdAt: true } }),
  ]);

  const out: AdminConversation[] = rows.map((r) => {
    const readAt = r.chatReads[0]?.readAt.getTime() ?? 0;
    const unread = incoming.filter((m) => m.bookingId === r.id && m.createdAt.getTime() > readAt).length;
    // A private message to the office is answered once the office writes privately to that same person afterwards.
    const needsReply = privateIn
      .filter((p) => p.bookingId === r.id)
      .some((p) => {
        const answered = privateOut.find((o) => o.bookingId === r.id && o.toParty === p.sender)?._max.createdAt;
        return !answered || answered < (p._max.createdAt as Date);
      });
    const last = r.messages[0];
    return {
      bookingId: r.id, code: r.confirmationCode, customer: r.guestName ?? r.user?.name ?? "Customer", driver: r.driver?.user.name ?? null, status: r.status,
      pickupAddress: r.pickupAddress, dropoffAddress: r.dropoffAddress, pickupAt: r.pickupDatetime.toISOString(),
      lastAt: last?.createdAt.toISOString() ?? null,
      lastPreview: last ? (last.body ? last.body.slice(0, 90) : last.attachmentId ? "Photo" : "") : null,
      lastPrivate: last?.scope === "PRIVATE",
      unread, needsReply,
    };
  });
  const filtered = filter === "unread" ? out.filter((c) => c.unread > 0) : out;
  return filtered.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export async function adminThread(bookingId: string, opts: { after?: string | null; before?: string | null; limit?: number } = {}) {
  const limit = Math.min(PAGE_MAX, Math.max(1, opts.limit ?? PAGE_DEFAULT));
  const time: Prisma.DateTimeFilter = {};
  const after = opts.after ? new Date(opts.after) : null;
  const before = opts.before ? new Date(opts.before) : null;
  if (after && !Number.isNaN(after.getTime())) time.gt = after;
  if (before && !Number.isNaN(before.getTime())) time.lt = before;
  const rows = await prisma.tripMessage.findMany({
    where: { bookingId, ...(Object.keys(time).length ? { createdAt: time } : {}) },
    orderBy: { createdAt: after ? "asc" : "desc" },
    take: limit + 1,
    select: MSG_SELECT,
  });
  const hasMore = !after && rows.length > limit;
  const page = rows.slice(0, limit);
  if (!after) page.reverse();
  return { messages: page.map(adminDto), hasMore };
}

/** The ride details beside the thread. Contact numbers are included only because the office is authorised to see them. */
export async function adminRideInfo(bookingId: string) {
  const b = await prisma.booking.findFirst({
    where: { id: bookingId, isDeleted: false },
    select: {
      id: true, confirmationCode: true, status: true, rideStage: true, pickupAddress: true, dropoffAddress: true, pickupDatetime: true, vehicleClass: true,
      passengers: true, luggage: true, flightNumber: true, rideEndedAt: true, updatedAt: true, guestName: true,
      user: { select: { name: true } },
      driver: { select: { user: { select: { name: true } }, vehicles: { where: { isActive: true }, take: 1, select: { make: true, model: true, licensePlate: true, color: true } } } },
    },
  });
  if (!b) return null;
  return {
    id: b.id, code: b.confirmationCode, status: b.status, stage: b.rideStage, pickupAddress: b.pickupAddress, dropoffAddress: b.dropoffAddress,
    pickupAt: b.pickupDatetime.toISOString(), vehicleClass: b.vehicleClass, passengers: b.passengers, luggage: b.luggage, flightNumber: b.flightNumber,
    customer: b.guestName ?? b.user?.name ?? "Customer",
    driver: b.driver?.user.name ?? null,
    vehicle: b.driver?.vehicles[0] ? [b.driver.vehicles[0].color, b.driver.vehicles[0].make, b.driver.vehicles[0].model].filter(Boolean).join(" ") + (b.driver.vehicles[0].licensePlate ? ` · ${b.driver.vehicles[0].licensePlate}` : "") : null,
    closedForApps: chatClosedReason({ status: b.status, rideEndedAt: b.rideEndedAt, updatedAt: b.updatedAt }),
    graceHours: CHAT_GRACE_MS / 3_600_000,
  };
}
