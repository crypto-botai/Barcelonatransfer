import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { HOURLY_RATES, MIN_HOURLY_HOURS, AIRPORT_SURCHARGE, NIGHT_SURCHARGE_RATE, calculateLastMinuteSurcharge, LAST_MINUTE_HOURS } from "@/lib/pricing";
import { isAirportLocation, isNightTime } from "@/lib/utils";
import { getQuote } from "@/lib/pricing-service";
import { FLEET_TO_DB_CLASS, type VehicleClass, type FleetVehicle } from "@/types";
import { roadDistance, resolveEndpoint } from "@/lib/geo";

const schema = z.object({
  bookingType:     z.enum(["TRANSFER", "HOURLY", "DAY_HIRE", "CORPORATE"]).default("TRANSFER"),
  pickupLat:       z.number(),
  pickupLng:       z.number(),
  dropoffLat:      z.number().optional(),
  dropoffLng:      z.number().optional(),
  vehicleClass:    z.string(),
  // The exact car chosen. Optional so older clients keep working; without it
  // the price falls back to the vehicle class, which is what it always was.
  fleetVehicle:    z.string().optional(),
  pickupDatetime:  z.string(),
  /**
   * Round trip: when the customer comes back. The return leg is the exact
   * reverse of the outbound one, so no second address pair is needed — which
   * is the whole point of the option, and the reason it takes a datetime
   * rather than a set of coordinates.
   */
  returnDatetime:  z.string().optional(),
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

    // Validated against the catalogue rather than trusted: an unknown value
    // simply prices as the vehicle class, never at a figure of the caller's
    // choosing.
    const fleetVehicle = body.fleetVehicle && body.fleetVehicle in FLEET_TO_DB_CLASS
      ? (body.fleetVehicle as FleetVehicle)
      : undefined;

    /**
     * One leg. Called twice for a round trip, the second time with the
     * endpoints swapped and the return moment.
     *
     * Distance is passed in rather than measured again: the road back is the
     * road out, and a second OSRM call would double the latency of every
     * return quote to say the same number. It matters only for custom routes
     * priced per km, where the difference is well inside the noise.
     *
     * getQuote is direction-aware — RETURN_LEG_SURCHARGES looks at the ordered
     * pair — so swapping the endpoints is what makes the ride out of Andorra
     * cost its €20 more, without this code knowing that rule exists.
     */
    const legQuote = (
      a: { lat: number; lng: number; address?: string },
      b: { lat: number; lng: number; address?: string },
      when: Date,
    ) => getQuote({
      // Pass the resolved coordinates through: zone detection falls back to
      // coordinates when the address text does not match a known zone, and it
      // cannot do that with 0,0 either.
      pickupLat: a.lat, pickupLng: a.lng,
      dropoffLat: b.lat, dropoffLng: b.lng,
      vehicleClass: vc,
      fleetVehicle,
      pickupDatetime: when,
      distanceKm, durationMin,
      pickupAddress:  a.address,
      dropoffAddress: b.address,
    });

    const outPoint = { lat: from?.lat ?? pickupLat,  lng: from?.lng ?? pickupLng,  address: body.pickupAddress };
    const backPoint = { lat: to?.lat  ?? dropoffLat, lng: to?.lng   ?? dropoffLng, address: body.dropoffAddress };

    const quote = await legQuote(outPoint, backPoint, pickupDate);

    // ── Round trip ───────────────────────────────────────────────────────────
    if (body.returnDatetime) {
      const returnDate = new Date(body.returnDatetime);

      if (isNaN(returnDate.getTime())) {
        return NextResponse.json({ error: "Invalid return date" }, { status: 422 });
      }
      // A return before the outbound is not a round trip, and pricing it would
      // quietly sell a journey that cannot happen.
      if (returnDate <= pickupDate) {
        return NextResponse.json(
          { error: "The return must be after the outbound pickup" },
          { status: 422 },
        );
      }

      const back = await legQuote(backPoint, outPoint, returnDate);

      // Either leg failing to price makes the whole trip unpriceable: quoting
      // half a round trip is the mis-sell this feature exists to end.
      if (quote.needsManualQuote || back.needsManualQuote) {
        return NextResponse.json({
          ...quote,
          isReturn: true,
          needsManualQuote: true,
        });
      }

      const leg = (q: typeof quote, when: Date) => ({
        baseFare:            q.baseFare,
        airportSurcharge:    q.airportSurcharge,
        nightSurcharge:      q.nightSurcharge,
        lastMinuteSurcharge: q.lastMinuteSurcharge,
        totalAmount:         q.totalAmount,
        pickupDatetime:      when.toISOString(),
        fromLabel:           q.fromLabel,
        toLabel:             q.toLabel,
      });

      return NextResponse.json({
        // The outbound leg still describes the top level, so every existing
        // reader of this response keeps working; totalAmount is the pair.
        ...quote,
        isReturn:    true,
        totalAmount: Math.round((quote.totalAmount + back.totalAmount) * 100) / 100,
        outboundLeg: leg(quote, pickupDate),
        returnLeg:   leg(back, returnDate),
      });
    }

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
