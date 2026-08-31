import type { FleetVehicle } from "@/types";

/**
 * Fleet vehicle → its detail page.
 *
 * /fleet linked to /book and to itself and nowhere else: six of the seven
 * vehicle pages had no in-content inbound link anywhere on the site, from a hub
 * whose entire job is to introduce them. These are commercial pages with buying
 * intent, so the hub now links each card to its own page.
 *
 * This mirrors SLUG_TO_CLASS in app/fleet/[slug]/page.tsx, which maps the same
 * pairs in the other direction to build the routes. The two are checked against
 * each other by lib/__tests__/fleet-links.test.ts so they cannot drift apart.
 */
export const FLEET_PAGE: Record<FleetVehicle, string> = {
  COROLLA:  "standard-sedan",
  CAMRY:    "business-sedan",
  TESLA_M3: "tesla-model-3",
  EQE_300:  "eqe-300-electric",
  VITO:     "executive-minivan",
  V_CLASS:  "luxury-minivan",
  SPRINTER: "group-minibus",
};

/** The detail page path for a vehicle, e.g. "/fleet/luxury-minivan". */
export function fleetPagePath(vehicle: FleetVehicle): string {
  return `/fleet/${FLEET_PAGE[vehicle]}`;
}
