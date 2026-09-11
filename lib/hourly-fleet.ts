import { VEHICLE_CATALOG, FLEET_TO_DB_CLASS, type FleetVehicle } from "@/types";
import { HOURLY_RATES, MIN_HOURLY_HOURS } from "@/lib/pricing";
import { fleetPagePath } from "@/lib/fleet-pages";

/**
 * The hourly line-up: every car, at the rate the booking will actually charge.
 *
 * /hourly used to publish four rate cards keyed on vehicle class, which left
 * three of the seven cars off the page entirely and lumped the Tesla in with
 * the EQE under one "Business / Electric Sedan" heading at a single price.
 * They are now priced apart, so one row per car is the only honest shape.
 *
 * Rates and minimums are read from lib/pricing rather than typed here. That is
 * the whole point of this module: those same constants are what /api/quote and
 * /api/bookings charge, so a card on this page cannot quote a figure the
 * checkout would not honour. Every stale price this site has carried began as
 * a correct number written by hand somewhere else.
 */
export type HourlyVehicle = {
  vehicle: FleetVehicle;
  label: string;
  /** A second car offered at the same rate in the same tier, where one exists. */
  alsoOffered?: string;
  image: string;
  href: string;
  rate: number;
  minHours: number;
  maxPassengers: number;
  largeBags: number;
  badge?: string;
  /** What this car is actually good for by the hour, not what it is in general. */
  suitedTo: string;
};

/**
 * Cars offered by the hour that are not in the transfer catalogue.
 *
 * The owner offers a Lexus on hourly hire. It is not a fleet vehicle, so it has
 * no page, no photograph and no fixed transfer fare, and inventing any of those
 * would be a claim the business has not made. It rides along on the business
 * saloon tier it shares a rate with, named in the copy, which is the most the
 * available facts support. Give it its own card when there is a real photo and
 * a real spec to put on one.
 */
const ALSO_OFFERED: Partial<Record<FleetVehicle, string>> = {
  CAMRY: "Lexus",
};

const SUITED_TO: Record<FleetVehicle, string> = {
  COROLLA:  "A day of city meetings for one or two people.",
  CAMRY:    "Client-facing days where the car is seen.",
  TESLA_M3: "Quiet, zero emission city running.",
  EQE_300:  "Executive days and corporate accounts.",
  VITO:     "Groups with luggage, or a family touring day.",
  V_CLASS:  "Weddings, VIP days, and touring in comfort.",
  SPRINTER: "Conference shuttles and group itineraries.",
};

export const HOURLY_FLEET: HourlyVehicle[] = VEHICLE_CATALOG.map((v) => {
  const dbClass = FLEET_TO_DB_CLASS[v.class];
  return {
    vehicle: v.class,
    label: v.label,
    alsoOffered: ALSO_OFFERED[v.class],
    image: v.image,
    href: fleetPagePath(v.class),
    rate: HOURLY_RATES[dbClass],
    minHours: MIN_HOURLY_HOURS[dbClass],
    maxPassengers: v.maxPassengers,
    largeBags: v.largeBags,
    badge: v.badge,
    suitedTo: SUITED_TO[v.class],
  };
});

/** The cheapest hourly rate on the fleet, for headlines and metadata. */
export const HOURLY_FROM = Math.min(...HOURLY_FLEET.map((v) => v.rate));

/** The shortest minimum booking across the fleet. */
export const HOURLY_MIN_HOURS = Math.min(...HOURLY_FLEET.map((v) => v.minHours));
