import { z } from "zod";
import type { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseQuery } from "@/lib/api/v1/validate";
import { CUSTOMER_RIDE_SELECT, customerRideDto } from "@/lib/api/v1/rides";

export const dynamic = "force-dynamic";

const query = z.object({
  scope: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().datetime().optional(),
});

/**
 * GET /api/v1/rides?scope=upcoming|past|all
 *
 * The caller's own rides, nearest first for upcoming and newest first for past.
 * A ride is "upcoming" until it is completed or cancelled and its pickup is not
 * more than an hour past. `before` pages backwards through older rides.
 */
export const GET = apiHandler(
  "rides.list",
  async ({ req, auth }) => {
    const q = parseQuery(req, query);
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60_000);
    const liveStatuses: BookingStatus[] = ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"];
    const doneStatuses: BookingStatus[] = ["COMPLETED", "CANCELLED", "REFUNDED"];

    const where: Prisma.BookingWhereInput = {
      userId: auth!.userId,
      isDeleted: false,
      // An unpaid, abandoned booking is not a ride the customer has.
      NOT: { status: "PENDING" as const, paymentStatus: "PENDING" as const, createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) } },
      ...(q.scope === "upcoming" ? { status: { in: liveStatuses }, pickupDatetime: { gte: hourAgo } } : {}),
      ...(q.scope === "past" ? { OR: [{ status: { in: doneStatuses } }, { pickupDatetime: { lt: hourAgo } }] } : {}),
      ...(q.before ? { pickupDatetime: { lt: new Date(q.before) } } : {}),
    };

    const rows = await prisma.booking.findMany({
      where,
      orderBy: { pickupDatetime: q.scope === "upcoming" ? "asc" : "desc" },
      take: q.limit + 1,
      select: CUSTOMER_RIDE_SELECT,
    });
    const page = rows.slice(0, q.limit);
    return {
      rides: page.map((r) => customerRideDto(r, now)),
      nextBefore: rows.length > q.limit ? page[page.length - 1].pickupDatetime.toISOString() : null,
    };
  },
  { auth: { roles: ["CUSTOMER"] } },
);
