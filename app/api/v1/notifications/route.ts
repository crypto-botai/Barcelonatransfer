import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { listNotifications, markAllRead, markRead } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/notifications
 *
 * The caller's own notifications, newest first: the same rows the website's portal
 * shows. Identifiers and wording only; a notification never carries a price or a phone
 * number.
 */
export const GET = apiHandler(
  "notifications.list",
  async ({ auth }) => {
    const rows = await listNotifications(auth!.userId, 50);
    return {
      notifications: rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        bookingId: typeof (n.data as { bookingId?: unknown } | null)?.bookingId === "string" ? ((n.data as { bookingId: string }).bookingId) : null,
      })),
      unread: rows.filter((n) => !n.read).length,
    };
  },
  { auth: { roles: ["CUSTOMER", "DRIVER"] } },
);

const patch = z.union([z.object({ all: z.literal(true) }), z.object({ id: z.string().min(1).max(64) })]);

/** PATCH /api/v1/notifications  { all: true } or { id } marks as read. Only the caller's own rows can match. */
export const PATCH = apiHandler(
  "notifications.read",
  async ({ req, auth }) => {
    const body = await parseBody(req, patch);
    if ("all" in body) return { updated: await markAllRead(auth!.userId) };
    return { updated: (await markRead(auth!.userId, body.id)) ? 1 : 0 };
  },
  { auth: { roles: ["CUSTOMER", "DRIVER"] } },
);
