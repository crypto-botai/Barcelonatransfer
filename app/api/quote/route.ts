import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateQuote, HOURLY_RATES, MIN_HOURLY_HOURS, AIRPORT_SURCHARGE, NIGHT_SURCHARGE_RATE } from "@/lib/pricing";
import { isAirportLocation, isNightTime } from "@/lib/utils";
import { type VehicleClass } from "@/types";

const schema = z.object({
  bookingType:    z.enum(["TRANSFER", "HOURLY", "DAY_HIRE", "CORPORATE"]).default("TRANSFER"),
  pickupLat:      z.number(),
  pickupLng:      z.number(),
  dropoffLat:     z.number().optional(),
  dropoffLng:     z.number().optional(),
  vehicleClass:   z.string(),
  pickupDatetime: z.string(),
  passengers:     z.number().int().min(1).max(20).optional(),
  durationHours:  z.number().min(1).max(24).optional(),
});

async function getOsrmDistance(
  originLat: number, originLng: number,
  destLat: number, destLng: number
): Promise<{ distanceKm: number; durationMin: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
    const res  = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();
    const route = data.routes?.[0];
    if (route) {
      return {
        distanceKm:  Math.round(route.distance / 100) / 10,
        durationMin: Math.ceil(route.duration / 60),
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
    const { pickupLat, pickupLng, vehicleClass, pickupDatetime, bookingType } = body;
    const pickupDate = new Date(pickupDatetime);
    const vc = vehicleClass as VehicleClass;

    if (bookingType === "HOURLY" || bookingType === "DAY_HIRE") {
      const minH  = MIN_HOURLY_HOURS[vc] ?? 4;
      const hours = bookingType === "DAY_HIRE" ? 8 : Math.max(body.durationHours ?? 4, minH);
      const hourlyRate = HOURLY_RATES[vc] ?? 50;
      const subtotal = hourlyRate * hours;
      const isNight = isNightTime(pickupDate);
      const nightSurcharge = isNight ? Math.round(subtotal * NIGHT_SURCHARGE_RATE * 100) / 100 : 0;
      const hasAirport = isAirportLocation(pickupLat, pickupLng);
      const airportSurcharge = hasAirport ? AIRPORT_SURCHARGE : 0;
      const totalAmount = Math.round((subtotal + nightSurcharge + airportSurcharge) * 100) / 100;

      return NextResponse.json({
        vehicleClass: vc,
        distanceKm:   0,
        durationMin:  hours * 60,
        baseFare:     subtotal,
        distanceFare: 0,
        airportSurcharge,
        nightSurcharge,
        vatAmount:    0,
        totalAmount,
        currency:     "EUR",
        hourlyRate,
        hours,
      });
    }

    // TRANSFER / CORPORATE — distance-based quote
    const dropoffLat = body.dropoffLat ?? 0;
    const dropoffLng = body.dropoffLng ?? 0;

    let distanceKm: number;
    let durationMin: number;

    if (dropoffLat && dropoffLng) {
      const osrm = await getOsrmDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
      if (osrm) {
        distanceKm  = osrm.distanceKm;
        durationMin = osrm.durationMin;
      } else {
        distanceKm  = Math.round(haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng) * 1.35 * 10) / 10;
        durationMin = Math.ceil((distanceKm / 50) * 60);
      }
    } else {
      distanceKm  = 0;
      durationMin = 0;
    }

    const quote = calculateQuote(
      vc, distanceKm, durationMin,
      pickupLat, pickupLng,
      dropoffLat, dropoffLng,
      pickupDate
    );

    return NextResponse.json({ vehicleClass: vc, ...quote });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    return NextResponse.json({ error: "Quote failed" }, { status: 500 });
  }
}
