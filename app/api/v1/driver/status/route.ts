import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { actorFor } from "@/lib/api/v1/actor";
import { callLegacy } from "@/lib/api/v1/legacy";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { requireDriver } from "@/lib/api/v1/driver-rides";
import { PATCH as websiteStatus } from "@/app/api/driver/status/route";

export const dynamic = "force-dynamic";

const body = z.object({ status: z.enum(["ONLINE", "OFFLINE"]) });

/** GET /api/v1/driver/status — the driver's availability and headline numbers for the home screen. */
export const GET = apiHandler(
  "driver.status.get",
  async ({ auth }) => {
    const driver = await requireDriver(auth!.userId);
    return { status: driver.status, rating: driver.rating > 0 ? driver.rating : null, totalRides: driver.totalRides };
  },
  { auth: { roles: ["DRIVER"] } },
);

/**
 * POST /api/v1/driver/status — go ONLINE or OFFLINE.
 *
 * Refused while a ride is in progress (the status is ON_RIDE then and moves by
 * itself when the ride completes), so a tap cannot orphan a passenger's trip.
 */
export const POST = apiHandler(
  "driver.status.set",
  async ({ req, auth }) => {
    const input = await parseBody(req, body);
    const driver = await requireDriver(auth!.userId);
    if (driver.status === "ON_RIDE") throw new ApiError("CONFLICT", "You are on a ride. Complete it first.");
    const actor = await actorFor(auth!);
    const { json } = await callLegacy(websiteStatus, { method: "PATCH", path: "/api/driver/status", body: input, actor, ip: clientAddress(req) });
    // Going offline also drops the stored position, so a stale dot is never shown.
    if (input.status === "OFFLINE") await prisma.driver.update({ where: { id: driver.id }, data: { currentLat: null, currentLng: null } }).catch(() => {});
    return { status: String(json.status ?? input.status) };
  },
  { auth: { roles: ["DRIVER"] } },
);
