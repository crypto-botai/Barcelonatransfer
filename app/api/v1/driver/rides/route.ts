import { z } from "zod";
import type { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseQuery } from "@/lib/api/v1/validate";
import { DRIVER_RIDE_SELECT, driverRideDto, madridDay, requireDriver } from "@/lib/api/v1/driver-rides";

export const dynamic = "force-dynamic";

const query = z.object({
  scope: z.enum(["today", "upcoming", "past", "pending"]).default("today"),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  before: z.string().datetime().optional(),
});

const OPEN: BookingStatus[] = ["DRIVER_ASSIGNED", "IN_PROGRESS"];

/**
 * GET /api/v1/driver/rides?scope=today|upcoming|past|pending
 *
 * Only rides assigned to the caller, whatever the query says.
 *   pending   assigned and not yet answered: the "New ride" list
 *   today     open rides from now until the end of the Madrid day, plus any in progress
 *   upcoming  open rides after today
 *   past      completed and cancelled, newest first (`before` pages backwards)
 */
export const GET = apiHandler(
  "driver.rides.list",
  async ({ req, auth }) => {
    const driver = await requireDriver(auth!.userId);
    const q = parseQuery(req, query);
    const now = new Date();
    const { end } = madridDay(now);

    const where: Prisma.BookingWhereInput = { driverId: driver.id, isDeleted: false };
    if (q.scope === "pending") Object.assign(where, { status: "DRIVER_ASSIGNED" as const, OR: [{ driverResponseBy: null }, { driverResponseBy: { not: driver.id } }, { driverResponse: null }] });
    if (q.scope === "today") Object.assign(where, { status: { in: OPEN }, pickupDatetime: { lt: end } });
    if (q.scope === "upcoming") Object.assign(where, { status: { in: OPEN }, pickupDatetime: { gte: end } });
    if (q.scope === "past") Object.assign(where, { status: { in: ["COMPLETED", "CANCELLED", "REFUNDED"] as BookingStatus[] }, ...(q.before ? { pickupDatetime: { lt: new Date(q.before) } } : {}) });

    const rows = await prisma.booking.findMany({
      where,
      orderBy: { pickupDatetime: q.scope === "past" ? "desc" : "asc" },
      take: q.limit + 1,
      select: DRIVER_RIDE_SELECT,
    });
    const page = rows.slice(0, q.limit);
    return {
      rides: page.map((r) => driverRideDto(r, now)),
      nextBefore: q.scope === "past" && rows.length > q.limit ? page[page.length - 1].pickupDatetime.toISOString() : null,
    };
  },
  { auth: { roles: ["DRIVER"] } },
);
