import { VEHICLE_CATALOG, FLEET_TO_DB_CLASS, type FleetVehicle, type VehicleClass } from "@/types";

/**
 * Whether the party fits in the car.
 *
 * The booking form filters the vehicle list by passenger count, so the normal
 * path was fine and nothing behind it checked. Two ways round that filter:
 *
 *   The customer picks a car for two, goes back and raises the party to
 *   eight. The list re-filters but the selection does not, so the four-seat
 *   EQE stays chosen.
 *
 *   A request sent directly. Sixteen passengers in a Toyota Corolla quoted
 *   EUR 80, against EUR 250 for the Sprinter that would actually be needed.
 *
 * Either way a chauffeur arrives with a car the party cannot get into, at an
 * airport, having been paid a third of the fare. The check belongs on the
 * server, where both paths go through it.
 */

/** The largest party a vehicle takes. A class is measured by its roomiest car. */
export function seatsFor(vehicleClass?: string | null, fleetVehicle?: string | null): number {
  if (fleetVehicle) {
    const v = VEHICLE_CATALOG.find((x) => x.class === fleetVehicle);
    if (v) return v.maxPassengers;
  }
  const inClass = VEHICLE_CATALOG.filter((x) => FLEET_TO_DB_CLASS[x.class] === vehicleClass);
  if (inClass.length) return Math.max(...inClass.map((x) => x.maxPassengers));
  // An unknown class is not a reason to refuse a booking; pricing already
  // falls back for one, and refusing here would be a stricter answer than
  // anything else in the system gives.
  return Infinity;
}

/** The smallest vehicle that takes this many people, for the error message. */
export function smallestFor(passengers: number): { label: string; fleetVehicle: FleetVehicle; vehicleClass: VehicleClass } | null {
  const fits = VEHICLE_CATALOG
    .filter((v) => v.maxPassengers >= passengers)
    .sort((a, b) => a.maxPassengers - b.maxPassengers)[0];
  return fits
    ? { label: fits.label, fleetVehicle: fits.class, vehicleClass: FLEET_TO_DB_CLASS[fits.class] }
    : null;
}

/**
 * A sentence explaining the mismatch, or null when the party fits.
 *
 * Refuses rather than quietly upgrading. An upgrade changes what the customer
 * pays without their agreeing to it, and a booking that silently costs three
 * times the figure on screen is worse than one that will not go through.
 */
export function capacityError(
  passengers: number,
  vehicleClass?: string | null,
  fleetVehicle?: string | null,
): string | null {
  if (!Number.isFinite(passengers) || passengers < 1) return null;
  const seats = seatsFor(vehicleClass, fleetVehicle);
  if (passengers <= seats) return null;

  const named = fleetVehicle
    ? VEHICLE_CATALOG.find((x) => x.class === fleetVehicle)?.label
    : null;
  const car = named ?? "That vehicle";
  const bigger = smallestFor(passengers);

  return bigger
    ? `${car} seats ${seats}. For ${passengers} passengers please choose the ${bigger.label}.`
    : `${car} seats ${seats}, and we do not have a single vehicle for ${passengers} passengers. Contact us and we will arrange more than one car.`;
}
