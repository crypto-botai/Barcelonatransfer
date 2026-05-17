import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateQuote } from "@/lib/pricing";
import { type VehicleClass } from "@/types";

const schema = z.object({
  pickupLat:       z.number(),
  pickupLng:       z.number(),
  dropoffLat:      z.number(),
  dropoffLng:      z.number(),
  vehicleClass:    z.string(),
  pickupDatetime:  z.string(),
  passengers:      z.number().int().min(1).max(20).optional(),
});

async function getGoogleDistance(
  originLat: number, originLng: number,
  destLat: number, destLng: number
): Promise<{ distanceKm: number; durationMin: number } | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    const el = data.rows?.[0]?.elements?.[0];
    if (el?.status === "OK") {
      return {
        distanceKm:  el.distance.value / 1000,
        durationMin: Math.ceil(el.duration.value / 60),
      };
    }
  } catch { /* fallback */ }
  return null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleClass, pickupDatetime } = body;

    // Try Google Distance Matrix first; fall back to haversine * 1.35 (road factor)
    let distanceKm: number;
    let durationMin: number;

    const google = await getGoogleDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    if (google) {
      distanceKm  = google.distanceKm;
      durationMin = google.durationMin;
    } else {
      distanceKm  = Math.round(haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng) * 1.35 * 10) / 10;
      durationMin = Math.ceil((distanceKm / 50) * 60);
    }

    const quote = calculateQuote(
      vehicleClass as VehicleClass,
      distanceKm,
      durationMin,
      pickupLat, pickupLng,
      dropoffLat, dropoffLng,
      new Date(pickupDatetime)
    );

    return NextResponse.json({ vehicleClass, ...quote });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    return NextResponse.json({ error: "Quote failed" }, { status: 500 });
  }
}
