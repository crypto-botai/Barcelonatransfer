import { prisma } from "@/lib/prisma";

/**
 * A booking request carries an Idempotency-Key. A repeat of the same key, after a
 * dropped connection or a double tap, returns the booking the first request made
 * instead of making a second one and charging twice.
 *
 * The key is stored with the account that used it (in activity_logs, an existing
 * table), so one person cannot read or replay another person's key.
 */

const ACTION = "API_V1_IDEMPOTENCY";
const key = (userId: string, idempotencyKey: string) => `${userId}:${idempotencyKey}`.slice(0, 200);

export function readKey(req: Request): string | null {
  const v = req.headers.get("idempotency-key")?.trim();
  return v && v.length >= 8 && v.length <= 100 ? v : null;
}

export async function findPriorBooking(userId: string, idempotencyKey: string): Promise<string | null> {
  const row = await prisma.activityLog
    .findFirst({ where: { action: ACTION, entity: "booking", entityId: key(userId, idempotencyKey) }, select: { details: true } })
    .catch(() => null);
  const id = (row?.details as { bookingId?: unknown } | null)?.bookingId;
  return typeof id === "string" ? id : null;
}

export async function rememberBooking(userId: string, idempotencyKey: string, bookingId: string): Promise<void> {
  await prisma.activityLog
    .create({ data: { action: ACTION, entity: "booking", entityId: key(userId, idempotencyKey), adminId: userId, details: { bookingId } } })
    .catch(() => undefined);
}
