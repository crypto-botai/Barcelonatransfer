import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, notFound } from "./errors";
import { parseBody } from "./validate";
import { requireOwnedRide } from "./rides";
import { requireDriver, requireDriverRide } from "./driver-rides";
import { audit } from "./audit";
import { clientAddress } from "./rate-limit";
import {
  ChatRuleError, chatClosedReason, chatContext, listChat, markChatRead, readAttachment, saveAttachment, sendChat, unreadByBooking, unreadCount,
  type ChatContext, type Party,
} from "@/lib/chat";

/**
 * The customer and driver chat endpoints share one implementation; only the way the caller proves they belong to the ride differs.
 * Every function authorises the caller against the ride FIRST. A ride that is not theirs is NOT_FOUND, the same answer as a ride that
 * does not exist, so a response never confirms that someone else's booking exists.
 */

export type ChatParty = Extract<Party, "CUSTOMER" | "DRIVER">;

export async function authoriseChat(party: ChatParty, rideId: string, userId: string): Promise<ChatContext> {
  if (party === "CUSTOMER") await requireOwnedRide(rideId, userId);
  else await requireDriverRide(rideId, (await requireDriver(userId)).id);
  const ctx = await chatContext(rideId);
  if (!ctx) throw notFound("We could not find that ride.");
  return ctx;
}

/** Turns the chat module's rule errors into API errors; anything else is left for the standard handler (a safe 500). */
function mapRule<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((e: unknown) => {
    if (e instanceof ChatRuleError) {
      throw new ApiError(e.code === "CLOSED" ? "CONFLICT" : "VALIDATION_FAILED", e.message);
    }
    throw e;
  });
}

const listQuery = z.object({
  after: z.string().max(40).optional(),
  before: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function chatThread(party: ChatParty, rideId: string, userId: string, url: URL) {
  const ctx = await authoriseChat(party, rideId, userId);
  const q = listQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) throw new ApiError("VALIDATION_FAILED", "That request could not be read.");
  const page = await listChat(rideId, party, q.data);
  // When the other app user and the office last opened the chat, so the app can show "read" ticks. Times only, never content.
  const peerParty = party === "CUSTOMER" ? "DRIVER" : "CUSTOMER";
  const reads = await prisma.tripChatRead.findMany({ where: { bookingId: rideId, party: { in: [peerParty, "ADMIN"] } }, select: { party: true, readAt: true } });
  const at = (p: string) => reads.find((r) => r.party === p)?.readAt.toISOString() ?? null;
  return {
    readAt: { peer: at(peerParty), office: at("ADMIN") },
    ...page,
    /** Why the apps cannot send, or null. Shown in place of the composer. */
    closed: chatClosedReason(ctx),
    unread: await unreadCount(rideId, party),
    serverTime: new Date().toISOString(),
  };
}

const sendBody = z.object({
  clientId: z.string().trim().min(8).max(64),
  text: z.string().max(4000).optional(),
  attachmentId: z.string().trim().max(64).optional(),
  /** True: only the office sees it. */
  private: z.boolean().optional(),
});

export async function chatSendMessage(party: ChatParty, rideId: string, userId: string, req: Request, requestId: string) {
  const ctx = await authoriseChat(party, rideId, userId);
  const input = await parseBody(req, sendBody);
  const out = await mapRule(() =>
    sendChat(ctx, party, { clientId: input.clientId, text: input.text, attachmentId: input.attachmentId, scope: input.private ? "PRIVATE" : "SHARED" }),
  );
  if (out.message.private && !out.duplicate) {
    await audit({ action: "API_V1_CHAT_PRIVATE_SEND", entity: "booking", entityId: rideId, actorId: userId, actorRole: party, requestId, ip: clientAddress(req), details: { messageId: out.message.id } });
  }
  return { message: out.message, duplicate: out.duplicate };
}

export async function chatMarkRead(party: ChatParty, rideId: string, userId: string) {
  await authoriseChat(party, rideId, userId);
  await markChatRead(rideId, party);
  return { read: true };
}

const photoBody = z.object({ data: z.string().min(16).max(2_200_000) });

export async function chatUploadPhoto(party: ChatParty, rideId: string, userId: string, req: Request) {
  const ctx = await authoriseChat(party, rideId, userId);
  const closed = chatClosedReason(ctx);
  if (closed) throw new ApiError("CONFLICT", closed);
  const input = await parseBody(req, photoBody);
  const id = await mapRule(() => saveAttachment(rideId, party, input.data));
  return { attachmentId: id };
}

export async function chatGetPhoto(party: ChatParty, rideId: string, userId: string, attachmentId: string) {
  await authoriseChat(party, rideId, userId);
  const file = await readAttachment(rideId, attachmentId, party);
  // The same answer whether the photo is missing or belongs to a message this person may not see.
  if (!file) throw notFound("We could not find that photo.");
  return { mime: file.mime, data: Buffer.from(file.data).toString("base64") };
}

/** Unread counts across the caller's recent rides, for the badge on the ride list and the tab. */
export async function chatUnread(party: ChatParty, userId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows =
    party === "CUSTOMER"
      ? await prisma.booking.findMany({ where: { userId, isDeleted: false, updatedAt: { gte: since } }, select: { id: true }, take: 50, orderBy: { updatedAt: "desc" } })
      : await prisma.booking.findMany({
          where: { driver: { userId }, isDeleted: false, status: { in: ["DRIVER_ASSIGNED", "IN_PROGRESS", "COMPLETED"] }, updatedAt: { gte: since } },
          select: { id: true }, take: 50, orderBy: { updatedAt: "desc" },
        });
  const byRide = await unreadByBooking(rows.map((r) => r.id), party);
  return { total: Object.values(byRide).reduce((a, b) => a + b, 0), byRide };
}
