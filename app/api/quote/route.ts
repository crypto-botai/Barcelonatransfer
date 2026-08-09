import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { HOURLY_RATES, MIN_HOURLY_HOURS, AIRPORT_SURCHARGE, NIGHT_SURCHARGE_RATE, calculateLastMinuteSurcharge, LAST_MINUTE_HOURS } from "@/lib/pricing";
import { isAirportLocation, isNightTime } from "@/lib/utils";
import { getQuote } from "@/lib/pricing-service";
import { type VehicleClass } from "@/types";
import { roadDistance, resolveEndpoint } from "@/lib/geo";

const schema = z.object({
  bookingType:     z.enum(["TRANSFER", "HOURLY", "DAY_HIRE", "CORPORATE"]).default("TRANSFER"),
  pickupLat:       z.number(),
  pickupLng:       z.number(),
  dropoffLat:      z.number().optional(),
  dropoffLng:      z.number().optional(),
  vehicleClass:    z.string(),
  pickupDatetime:  z.string(),
  passengers:      z.number().int().min(1).max(20).optional(),
  durationHours:   z.number().min(1).max(24).optional(),
  // Address text for text-based zone resolution (more reliable than coords alone)
  pickupAddress:   z.string().optional(),
  dropoffAddress:  z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // A non-JSON body throws here, before zod runs, so it would otherwise
    // escape the ZodError branch below and be reported as a server error.
    const raw = await req.json().catch(() => null);
    if (raw === null) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const body = schema.parse(raw);
    const { pickupLat, pickupLng, vehicleClass, pickupDatetime, bookingType } = body;
    const pickupDate = new Date(pickupDatetime);
    const vc = vehicleClass as VehicleClass;

    if (bookingType === "HOURLY" || bookingType === "DAY_HIRE") {
      const minH      = MIN_HOURLY_HOURS[vc] ?? 4;
      const hours     = bookingType === "DAY_HIRE" ? 8 : Math.max(body.durationHours ?? 4, minH);
      const hourlyRate = HOURLY_RATES[vc] ?? 50;
      const subtotal   = hourlyRate * hours;
      const isNight    = isNightTime(pickupDate);
      const nightSurcharge   = isNight ? Math.round(subtotal * NIGHT_SURCHARGE_RATE * 100) / 100 : 0;
      const hasAirport       = isAirportLocation(pickupLat, pickupLng);
      const airportSurcharge = hasAirport ? AIRPORT_SURCHARGE : 0;
      const baseTotal        = Math.round((subtotal + nightSurcharge + airportSurcharge) * 100) / 100;
      const lastMinuteSurcharge = calculateLastMinuteSurcharge(baseTotal, pickupDate);
      const totalAmount      = Math.round((baseTotal + lastMinuteSurcharge) * 100) / 100;

      return NextResponse.json({
        vehicleClass: vc, distanceKm: 0, durationMin: hours * 60,
        baseFare: subtotal, distanceFare: 0, airportSurcharge, nightSurcharge,
        lastMinuteSurcharge, vatAmount: 0, totalAmount, currency: "EUR",
        hourlyRate, hours, isFixed: false, isCustomRoute: false,
      });
    }

    // TRANSFER / CORPORATE — fixed-price lookup via getQuote()
    const dropoffLat = body.dropoffLat ?? 0;
    const dropoffLng = body.dropoffLng ?? 0;

    // The booking form only attaches coordinates when the customer clicks a
    // suggestion in the address dropdown. Typing a valid address and moving on
    // posts 0,0, which used to leave nothing to measure and turned an ordinary
    // journey into "contact us". Resolve the address text server-side instead,
    // so a fare never depends on how the customer used the autocomplete.
    const [from, to] = await Promise.all([
      resolveEndpoint(pickupLat,  pickupLng,  body.pickupAddress),
      resolveEndpoint(dropoffLat, dropoffLng, body.dropoffAddress),
    ]);

    let distanceKm  = 0;
    let durationMin = 0;

    if (from && to) {
      // roadDistance() handles the OSRM call, the day-long cache, and the
      // straight-line fallback, so the chat booking path and this one cannot
      // drift apart on the same journey.
      const route = await roadDistance(from, to);
      distanceKm  = route.distanceKm;
      durationMin = route.durationMin;
    }

    const quote = await getQuote({
      // Pass the resolved coordinates through: zone detection falls back to
      // coordinates when the address text does not match a known zone, and it
      // cannot do that with 0,0 either.
      pickupLat:   from?.lat ?? pickupLat,
      pickupLng:   from?.lng ?? pickupLng,
      dropoffLat:  to?.lat   ?? dropoffLat,
      dropoffLng:  to?.lng   ?? dropoffLng,
      vehicleClass: vc, pickupDatetime: pickupDate,
      distanceKm, durationMin,
      pickupAddress:  body.pickupAddress,
      dropoffAddress: body.dropoffAddress,
    });

    // Log every custom-route lookup so the admin knows which routes to add next
    if (quote.isCustomRoute) {
      console.info(
        `[pricing-backlog] custom-route pickup="${body.pickupAddress ?? `${pickupLat},${pickupLng}`}" dropoff="${body.dropoffAddress ?? `${dropoffLat},${dropoffLng}`}" vehicle=${vc} at ${new Date().toISOString()}`
      );
    }

    return NextResponse.json(quote);
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    return NextResponse.json({ error: "Quote failed" }, { status: 500 });
  }
}
