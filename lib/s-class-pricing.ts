/**
 * The Mercedes-Maybach S 580's prices, which are the owner's own and follow different rules from every other car.
 *
 * Set by the owner on 22 Oct 2026:
 *  - Instant booking, fixed fares: airport to city 250, city to airport 235, Sants station to city 175, city to Sants 165, and the
 *    airport and Sants priced like the airport and the city: airport to Sants 250, Sants to airport 235.
 *  - Anywhere else (not the port): 4.75 euros per kilometre of road.
 *  - By the hour: 160 in the city, 195 outside it. Waiting is charged at 160 an hour as well.
 *  - The port (cruise terminals, Moll Adossat) is NOT taken: nobody can book the S-Class to or from it. They are told to send a query.
 *
 * It lives apart from the route table (lib/fixed-prices.ts) on purpose. That table prices every car from five columns and matches
 * a route both ways round; adding the S-Class to it would have changed nothing for the others but would have needed a direction
 * for every fare. Here each fare is for one direction and nothing else can read it by accident.
 */

/** Per kilometre of road, for any journey with no fixed fare. */
export const S_CLASS_PER_KM = 4.75;

/**
 * The least a per-kilometre S-Class journey costs. The owner did not give a minimum: this is the lowest fixed S-Class fare (city to
 * Sants), so that a short hop never prices below the shortest journey that has a fare of its own.
 */
export const S_CLASS_MIN_FARE = 165;

/** Hourly hire. */
export const S_CLASS_HOURLY_IN_CITY = 160;
export const S_CLASS_HOURLY_OUT_OF_CITY = 195;

/** Waiting beyond the included time, per hour. Charged in half-hour blocks like every other car, so a block is half of this. */
export const S_CLASS_WAIT_PER_HOUR = 160;

// Zone keys are the ones lib/pricing.ts resolves: "airport", "barcelona_city", "sants" (the port is "cruise").
const FIXED: Record<string, number> = {
  "airport>barcelona_city": 250,
  "barcelona_city>airport": 235,
  "sants>barcelona_city": 175,
  "barcelona_city>sants": 165,
  // Sants station and the airport cost the same as the city and the airport, each way (owner, 22 Oct 2026).
  "airport>sants": 250,
  "sants>airport": 235,
};

/** The fixed one-way fare, or null when the pair has none. Direction matters: the key is "from>to". */
export function sClassFixedFare(fromZone: string | null, toZone: string | null): number | null {
  if (!fromZone || !toZone) return null;
  return FIXED[`${fromZone}>${toZone}`] ?? null;
}

const rad = (d: number) => (d * Math.PI) / 180;
function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// The cruise terminals on Moll Adossat and the World Trade Center quay, and the words people type for them.
const PORT_WORDS = /\b(cruise|crucero|creuers|port de barcelona|port of barcelona|moll adossat|moll de barcelona|moll de la fusta|adossat|terminal [a-e]\b|world trade center|wtc\b|puerto de barcelona|barcelona port)\b/;
const PORT_CENTRE = { lat: 41.35, lng: 2.175 };
const PORT_RADIUS_KM = 2.6;

/**
 * Whether a place is at the port. The S-Class does not go there (for now), so a journey that starts or ends at one is never priced.
 * Found by the zone the site already resolves, by the words in the address, and by a circle around Moll Adossat, because the
 * "Barcelona city" zone is 12 km wide and would otherwise swallow a terminal typed as a plain street address.
 */
export function isPortPlace(p: { zone?: string | null; lat?: number | null; lng?: number | null; address?: string | null }): boolean {
  if (p.zone === "cruise") return true;
  const text = (p.address ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (text && PORT_WORDS.test(text)) return true;
  if (typeof p.lat === "number" && typeof p.lng === "number" && (p.lat !== 0 || p.lng !== 0)) {
    return km(p.lat, p.lng, PORT_CENTRE.lat, PORT_CENTRE.lng) <= PORT_RADIUS_KM;
  }
  return false;
}

/** The per-kilometre fare for a journey of this many road kilometres, whole euros, never under the minimum. */
export function sClassKmFare(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  return Math.max(S_CLASS_MIN_FARE, Math.round(distanceKm * S_CLASS_PER_KM));
}

/** The hourly rate: in the city (Barcelona, Sants, the airport) or outside it. */
export function sClassHourlyRate(pickupZone: string | null): number {
  return pickupZone === "barcelona_city" || pickupZone === "sants" || pickupZone === "airport" ? S_CLASS_HOURLY_IN_CITY : S_CLASS_HOURLY_OUT_OF_CITY;
}

export const S_CLASS_PORT_MESSAGE = "The Mercedes-Maybach S 580 does not take bookings to or from the port. Please send us a query and we will come back to you.";
