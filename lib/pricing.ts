import { VehicleClass, QuoteRequest, QuoteResponse } from "@/types";
import { isAirportLocation, isNightTime } from "@/lib/utils";

export const DEFAULT_PRICING: Record<VehicleClass, {
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
}> = {
  ECONOMY:       { baseFare: 15,  pricePerKm: 1.10, pricePerMinute: 0.18, minimumFare: 20  },
  BUSINESS:      { baseFare: 20,  pricePerKm: 1.30, pricePerMinute: 0.22, minimumFare: 28  },
  LUXURY:        { baseFare: 28,  pricePerKm: 1.60, pricePerMinute: 0.28, minimumFare: 38  },
  FIRST_CLASS:   { baseFare: 40,  pricePerKm: 2.00, pricePerMinute: 0.38, minimumFare: 55  },
  ELECTRIC_VIP:  { baseFare: 35,  pricePerKm: 1.80, pricePerMinute: 0.32, minimumFare: 48  },
  SUV:           { baseFare: 32,  pricePerKm: 1.70, pricePerMinute: 0.30, minimumFare: 45  },
  LUXURY_SUV:    { baseFare: 55,  pricePerKm: 2.20, pricePerMinute: 0.42, minimumFare: 70  },
  MINIVAN:       { baseFare: 30,  pricePerKm: 1.50, pricePerMinute: 0.26, minimumFare: 42  },
  LUXURY_MINIVAN:{ baseFare: 50,  pricePerKm: 2.00, pricePerMinute: 0.38, minimumFare: 65  },
  MINIBUS:       { baseFare: 70,  pricePerKm: 2.20, pricePerMinute: 0.42, minimumFare: 90  },
};

export const AIRPORT_SURCHARGE = 8;
export const NIGHT_SURCHARGE_RATE = 0.20;

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
