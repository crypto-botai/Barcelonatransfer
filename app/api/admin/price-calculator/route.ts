import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getQuote } from "@/lib/pricing-service";
import { resolveEndpoint, roadDistance } from "@/lib/geo";
import { liveRoute } from "@/lib/geo/live-route";
import { parsePickupInput } from "@/lib/datetime";
import { FLEET_TO_DB_CLASS, VEHICLE_CATALOG, type FleetVehicle } from "@/types";

export const dynamic = "force-dynamic";

const point = z.object({
  address: z.string().max(300).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
const schema = z.object({
  pickup: point,
  dropoff: point,
  /** Wall clock in Barcelona, e.g. "2026-10-20T14:30". Defaults to now. Night, weekend and last-minute rules depend on it. */
  pickupDatetime: z.string().optional(),
});

/**
 * POST /api/admin/price-calculator: ADMIN only.
 *
 * What the checkout would charge for a journey from one point to another, for every car, with the road route to draw. It calls the same
 * getQuote() the booking form uses, so the figure here is the figure a customer is shown. Nothing is saved or sent.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { pickup, dropoff } = parsed.data;

  const when = (parsed.data.pickupDatetime && parsePickupInput(parsed.data.pickupDatetime)) || new Date();
  const [from, to] = await Promise.all([
    resolveEndpoint(pickup.lat, pickup.lng, pickup.address),
    resolveEndpoint(dropoff.lat, dropoff.lng, dropoff.address),
  ]);
  if (!from || !to) return NextResponse.json({ error: "Could not find one of the two places. Pick a suggestion or type a fuller address." }, { status: 422 });

  const road = await roadDistance(from, to);
  const route = await liveRoute(`calc:${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}:trip`, from, to);

  const quotes = await Promise.all(
    VEHICLE_CATALOG.map(async (v) => {
      const fleetVehicle = v.class as FleetVehicle;
      const q = await getQuote({
        pickupLat: from.lat, pickupLng: from.lng, dropoffLat: to.lat, dropoffLng: to.lng,
        vehicleClass: FLEET_TO_DB_CLASS[fleetVehicle], fleetVehicle,
        pickupDatetime: when, distanceKm: road.distanceKm, durationMin: road.durationMin,
        pickupAddress: pickup.address, dropoffAddress: dropoff.address,
      });
      return {
        vehicle: v.label, badge: v.badge ?? null, maxPassengers: v.maxPassengers,
        total: q.totalAmount, basis: q.needsManualQuote ? "none" : q.isFixed ? "table" : "distance",
        fromLabel: q.fromLabel ?? null, toLabel: q.toLabel ?? null,
      };
    }),
  );

  return NextResponse.json({
    from, to, pickupAt: when.toISOString(),
    distanceKm: road.distanceKm, durationMin: road.durationMin, preciseDistance: road.precise,
    routeBasis: route.basis, routeCoordinates: route.coordinates,
    quotes,
  });
}
