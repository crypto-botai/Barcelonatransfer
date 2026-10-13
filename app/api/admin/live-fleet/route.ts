import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCoords } from "@/lib/geo";
import { arrivalAt, freshness, liveRoute } from "@/lib/geo/live-route";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/live-fleet
 *
 * Administrators only (the ADMIN role, checked on the server on every call): the rides under way or about to start, each with the
 * driver's latest position and how fresh it is. The passenger's position is included only while the passenger has chosen to share it
 * (a fix in the last three minutes) and is never kept beyond the booking's own row. Each read that includes a passenger position is
 * written to the activity log, so there is a record of who looked.
 *
 * trackingState: "live" (fix within 30 s), "delayed" (within 2 min), "stale" (older), "no-signal" (no fix yet for this ride).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const admin = session?.user as { role?: string; id?: string; name?: string } | undefined;
  if (!session || admin?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const soon = new Date(Date.now() + 90 * 60_000);
  const rides = await prisma.booking.findMany({
    where: {
      isDeleted: false,
      OR: [
        { status: "IN_PROGRESS" },
        { status: "DRIVER_ASSIGNED", rideStage: { not: null } },
        { status: "DRIVER_ASSIGNED", rideStage: null, pickupDatetime: { lte: soon } },
      ],
      NOT: { rideStage: "COMPLETED" },
    },
    orderBy: { pickupDatetime: "asc" },
    take: 100,
    select: {
      id: true, confirmationCode: true, status: true, rideStage: true, pickupDatetime: true,
      pickupAddress: true, pickupLat: true, pickupLng: true, dropoffAddress: true, dropoffLat: true, dropoffLng: true,
      customerLat: true, customerLng: true, customerLocatedAt: true,
      driver: { select: { id: true, user: { select: { name: true, phone: true } }, vehicles: { where: { isActive: true }, take: 1, orderBy: { updatedAt: "desc" }, select: { make: true, model: true, licensePlate: true } } } },
    },
  });

  const now = Date.now();
  let customerReads = 0;
  const out = await Promise.all(
    rides.map(async (r) => {
      const fix = await prisma.rideTracking.findFirst({ where: { bookingId: r.id }, orderBy: { createdAt: "desc" }, select: { lat: true, lng: true, speed: true, heading: true, createdAt: true } });
      const age = fix ? Math.max(0, Math.round((now - fix.createdAt.getTime()) / 1000)) : null;
      const customerShared = r.customerLocatedAt !== null && now - r.customerLocatedAt.getTime() < 3 * 60_000 && r.customerLat !== null && r.customerLng !== null;
      if (customerShared) customerReads++;
      // The road from the car to its next stop (the pickup, or the destination once the passenger is on board), road-network time.
      const onBoard = r.rideStage === "ON_BOARD";
      const next = onBoard ? { lat: r.dropoffLat, lng: r.dropoffLng } : { lat: r.pickupLat, lng: r.pickupLng };
      const leg = fix && hasCoords(next.lat, next.lng) && r.rideStage !== "ARRIVED" && r.rideStage !== "WAITING_PASSENGER" ? await liveRoute(`${r.id}:${onBoard ? "to-drop" : "to-pickup"}`, { lat: fix.lat, lng: fix.lng }, { lat: next.lat as number, lng: next.lng as number }, now) : null;
      return {
        id: r.id,
        code: r.confirmationCode,
        status: r.status,
        stage: r.rideStage,
        pickupAt: r.pickupDatetime.toISOString(),
        pickup: { address: r.pickupAddress, lat: r.pickupLat, lng: r.pickupLng },
        dropoff: r.dropoffAddress.trim() ? { address: r.dropoffAddress, lat: r.dropoffLat, lng: r.dropoffLng } : null,
        driver: r.driver ? { id: r.driver.id, name: r.driver.user.name, phone: r.driver.user.phone, car: r.driver.vehicles[0] ? `${r.driver.vehicles[0].make} ${r.driver.vehicles[0].model}`.trim() : null, plate: r.driver.vehicles[0]?.licensePlate ?? null } : null,
        position: fix ? { lat: fix.lat, lng: fix.lng, speed: fix.speed, heading: fix.heading, at: fix.createdAt.toISOString(), ageSeconds: age } : null,
        trackingState: age === null ? "no-signal" : freshness(age),
        leg: leg ? { toward: onBoard ? "DROPOFF" : "PICKUP", km: leg.distanceKm, minutes: leg.durationMin, arrivesAt: arrivalAt(leg.durationMin, now), basis: leg.basis, line: leg.coordinates } : null,
        customer: customerShared ? { lat: r.customerLat, lng: r.customerLng, at: r.customerLocatedAt!.toISOString() } : null,
      };
    }),
  );

  if (customerReads > 0) {
    await prisma.activityLog
      .create({ data: { adminId: admin.id ?? "admin", adminName: admin.name ?? "Admin", action: "VIEW_LIVE_CUSTOMER_LOCATIONS", entity: "LIVE_FLEET", entityId: "live-fleet", details: { rides: customerReads } as never } })
      .catch(() => {});
  }

  return NextResponse.json({ generatedAt: new Date(now).toISOString(), rides: out });
}
