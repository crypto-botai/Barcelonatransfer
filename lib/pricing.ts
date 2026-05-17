import { VehicleClass, QuoteRequest, QuoteResponse } from "@/types";
import { isAirportLocation, isNightTime } from "@/lib/utils";

export const DEFAULT_PRICING: Record<VehicleClass, {
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
}> = {
  ECONOMY:       { baseFare: 30,  pricePerKm: 1.50, pricePerMinute: 0.25, minimumFare: 30  },
  BUSINESS:      { baseFare: 40,  pricePerKm: 1.80, pricePerMinute: 0.30, minimumFare: 40  },
  LUXURY:        { baseFare: 55,  pricePerKm: 2.20, pricePerMinute: 0.40, minimumFare: 55  },
  FIRST_CLASS:   { baseFare: 80,  pricePerKm: 3.00, pricePerMinute: 0.55, minimumFare: 80  },
  ELECTRIC_VIP:  { baseFare: 70,  pricePerKm: 2.60, pricePerMinute: 0.50, minimumFare: 70  },
  SUV:           { baseFare: 65,  pricePerKm: 2.40, pricePerMinute: 0.45, minimumFare: 65  },
  LUXURY_SUV:    { baseFare: 100, pricePerKm: 3.50, pricePerMinute: 0.65, minimumFare: 100 },
  MINIVAN:       { baseFare: 55,  pricePerKm: 2.00, pricePerMinute: 0.35, minimumFare: 55  },
  LUXURY_MINIVAN:{ baseFare: 90,  pricePerKm: 2.80, pricePerMinute: 0.55, minimumFare: 90  },
  MINIBUS:       { baseFare: 120, pricePerKm: 3.20, pricePerMinute: 0.60, minimumFare: 120 },
};

export const AIRPORT_SURCHARGE = 10;
export const NIGHT_SURCHARGE_RATE = 0.25;

export function calculateQuote(
  vehicleClass: VehicleClass,
  distanceKm: number,
  durationMin: number,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  pickupDatetime: Date,
  pricing = DEFAULT_PRICING
): Omit<QuoteResponse, "vehicleClass"> {
  const p = pricing[vehicleClass];

  const distanceFare = distanceKm * p.pricePerKm;
  const subtotal = p.baseFare + distanceFare;

  const hasAirport =
    isAirportLocation(pickupLat, pickupLng) ||
    isAirportLocation(dropoffLat, dropoffLng);
  const airportSurcharge = hasAirport ? AIRPORT_SURCHARGE : 0;

  const isNight = isNightTime(pickupDatetime);
  const nightSurcharge = isNight ? subtotal * NIGHT_SURCHARGE_RATE : 0;

  const total = Math.max(subtotal + airportSurcharge + nightSurcharge, p.minimumFare);

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin,
    baseFare: p.baseFare,
    distanceFare: Math.round(distanceFare * 100) / 100,
    airportSurcharge,
    nightSurcharge: Math.round(nightSurcharge * 100) / 100,
    totalAmount: Math.round(total * 100) / 100,
    currency: "EUR",
  };
}
