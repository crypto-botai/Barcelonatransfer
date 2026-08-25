import { VEHICLE_CATALOG } from "@/types";

/**
 * What the fleet can actually be said to offer, derived from the catalogue.
 *
 * The site made three amenity claims in prose, on nine pages and in the AI
 * support prompt, and the vehicle catalogue supports none of them as written:
 *
 *   "All vehicles are under 3 years old"
 *       Vehicle age is not recorded anywhere in the codebase. It cannot be
 *       derived, it cannot be checked, and it decays on its own — a car that
 *       made the claim true when it was written stops doing so without anyone
 *       editing a file. The 25 Aug data-accuracy work removed this from
 *       llms.txt for exactly that reason; the HTML pages kept saying it.
 *
 *   "equipped with complimentary water"
 *       One of seven vehicles lists it. The EQE 300 carries "Water & Mints".
 *       No other car in the catalogue mentions water at all.
 *
 *   "and WiFi"
 *       Five of seven. The V-Class and the Sprinter do not list it.
 *
 * A claim that is true of one car in seven is not a fleet feature, and "all"
 * is the word that makes it false rather than merely optimistic. These helpers
 * return what is true, counted from the catalogue, so a change to a car's
 * feature list moves the sentence on every page with it.
 */

const CARS = VEHICLE_CATALOG;

function withFeature(match: RegExp): typeof CARS {
  return CARS.filter((v) => v.features.some((f) => match.test(f)));
}

const WITH_WIFI = withFeature(/wifi/i);
const WITH_WATER = withFeature(/water/i);
const WITH_AC = withFeature(/air conditioning|climate control/i);

/** True only if every car in the catalogue lists it. */
function isUniversal(cars: typeof CARS): boolean {
  return cars.length === CARS.length;
}

export const FLEET_FACTS = {
  total: CARS.length,
  wifiCount: WITH_WIFI.length,
  waterCount: WITH_WATER.length,
  wifiUniversal: isUniversal(WITH_WIFI),
  waterUniversal: isUniversal(WITH_WATER),
  climateUniversal: isUniversal(WITH_AC),
} as const;

/**
 * The amenity sentence for a fleet-wide context.
 *
 * Says "most" where the catalogue says most, and names the exception rather
 * than rounding it up to "all". Deliberately makes no claim about vehicle age.
 */
export function amenitySentence(): string {
  const parts: string[] = [];

  if (FLEET_FACTS.climateUniversal) parts.push("air-conditioned");
  else parts.push("climate controlled in most cars");

  if (FLEET_FACTS.wifiUniversal) {
    parts.push("with WiFi");
  } else {
    parts.push(`with WiFi in ${FLEET_FACTS.wifiCount} of the ${FLEET_FACTS.total}`);
  }

  return `Vehicles are ${parts.join(", ")}. Each car lists what it carries on its own page.`;
}

/**
 * The vehicles, named honestly, for a "what do you drive" answer.
 *
 * The sitewide FAQ answered this with four Mercedes and nothing else, which
 * omitted both Toyotas and the Tesla — three of the seven cars, including the
 * two cheapest, which are the ones most bookings actually use. Derived so the
 * list cannot go stale when the fleet changes.
 */
export function fleetSummary(): string {
  return CARS.map((v) => `${v.label} (${v.maxPassengers} passengers, ${v.largeBags} large cases)`)
    .join("; ");
}

/** The per-car amenity line used on destination pages. */
export function vehicleAmenityLine(): string {
  const names = CARS.slice(0, 3).map((v) => v.label).join(", ");
  return `${names} and more. ${amenitySentence()}`;
}
