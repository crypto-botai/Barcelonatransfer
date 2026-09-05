/**
 * pricing-service.ts — the ONLY path to a customer-facing price.
 *
 * getQuote() returns a fixed table price when the route is in the table, and a
 * per-kilometre price when it is not.
 *
 * The table always wins. Distance pricing is only ever reached for a journey
 * that has no row in the table, and can never override or undercut one.
 *
 * Zone resolution order (for each endpoint):
 *  1. Text-based resolveZone() on the address string (most accurate)
 *  2. Coordinate-based detectZoneFromCoords() as fallback
 *  3. null → priced at PER_KM_RATE x distance (isCustomRoute: true)
 *
 * Cache: tagged "pricing" so revalidateTag("pricing") flushes on admin save.
 * Fallback: if the DB is unreachable, falls back to ROUTES from lib/pricing.ts.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ROUTES as FALLBACK_ROUTES,
  ZONE_LABELS,
  resolveZoneStrict,
  resolveZoneBroad,
  detectZoneFromCoords,
  vehicleCodeForClass,
  lookupFixedPriceByZone,
  distanceFare,
  KEY_TO_ZONE_CODE,
} from "@/lib/pricing";
import { FIXED_ROUTES, returnLegSurcharge } from "@/lib/fixed-prices";
import { haversineDistance } from "@/lib/utils";
import type { VehicleClass, FleetVehicle } from "@/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PublicRoute {
  id:        string;
  slug:      string;
  label:     string;
  category:  string;
  /** Pricing zone keys, so a caller can find the route for a destination. */
  fromKey:   string;
  toKey:     string;
  note:      string | null;
  sortOrder: number;
  economy:   number;
  business:  number;
  minivan:   number;
  vclass:    number;
  minibus:   number;
  updatedAt: Date;
}

export interface QuoteInput {
  pickupLat:       number;
  pickupLng:       number;
  dropoffLat:      number;
  dropoffLng:      number;
  vehicleClass:    VehicleClass;
  /** The exact car chosen, when the caller knows it. Enables per-car pricing. */
  fleetVehicle?:   FleetVehicle;
  pickupDatetime:  Date;
  distanceKm:      number;
  durationMin:     number;
  pickupAddress?:  string;   // free-text for text-based zone resolution
  dropoffAddress?: string;   // free-text for text-based zone resolution
}

export interface Quote {
  vehicleClass:          VehicleClass;
  distanceKm:            number;
  durationMin:           number;
  baseFare:              number;
  distanceFare:          number;
  airportSurcharge:      number;
  nightSurcharge:        number;
  lastMinuteSurcharge:   number;
  vatAmount:             number;
  totalAmount:           number;
  currency:              string;
  isFixed:               boolean;
  /** true = priced per km from distance rather than read from the fixed table */
  isCustomRoute:         boolean;
  /** true = no price could be produced at all; the UI must ask the customer to contact us */
  needsManualQuote?:     boolean;
  fromLabel?:            string;   // e.g. "El Prat Airport"
  toLabel?:              string;   // e.g. "Barcelona City"
}

// ── Zone resolution ───────────────────────────────────────────────────────────

/**
 * Resolves one end of a journey to a pricing zone.
 *
 * Order matters, and it changed to close a pricing hole:
 *
 *  1. A specific named place in the text wins outright. "Sitges", "Terminal 1"
 *     and "PortAventura" identify a destination exactly, and are more reliable
 *     than a geocoded pin that may land on the edge of a town.
 *
 *  2. Coordinates settle everything else. They place the address precisely.
 *
 *  3. Only with no usable coordinates do we fall back to matching a province
 *     name, which is a guess.
 *
 * Previously any text match beat coordinates, including the province fallback.
 * Every Catalan address carries its province — "Sant Andreu de la Barca, Baix
 * Llobregat, Barcelona, Catalonia" — so a bare "barcelona" match swallowed all
 * ~300 unlisted towns in the province and priced them as Barcelona city. A
 * 28 km run to Sant Andreu de la Barca quoted €50 instead of a distance fare.
 */
function resolveEndpointZone(lat: number, lng: number, address?: string): string | null {
  if (address) {
    const exact = resolveZoneStrict(address);
    if (exact) return exact;
  }

  // 0,0 means "no coordinates", not the Gulf of Guinea.
  const hasCoords = Boolean(lat && lng && Number.isFinite(lat) && Number.isFinite(lng));
  if (hasCoords) return detectZoneFromCoords(lat, lng);

  return address ? resolveZoneBroad(address) : null;
}

// ── DB-cached route reads ─────────────────────────────────────────────────────

type DBRouteRow = {
  id: string; slug: string; fromKey: string; toKey: string;
  label: string; category: string; note: string | null;
  sortOrder: number; active: boolean; updatedAt: Date;
  prices: { vehicleCode: string; price: number; updatedAt: Date; updatedBy: string | null }[];
};

const _getRoutesFromDB = unstable_cache(
  async (): Promise<DBRouteRow[]> => {
    return prisma.route.findMany({
      where:   { active: true },
      include: { prices: true },
      orderBy: { sortOrder: "asc" },
    });
  },
  // The version suffix is a manual cache-buster.
  //
  // Vercel's Data Cache survives deployments, so shipping new code does not by
  // itself clear this. Editing prices through the admin panel calls
  // revalidateTag("pricing") and needs none of this; but a price written
  // straight to the database — a seed run, or a one-off correction — bypasses
  // that and leaves stale figures served for up to an hour.
  //
  // Bump the suffix when changing prices by direct database write, or call
  // /api/cron/revalidate-pricing with the cron secret. Last bumped 13 Aug 2026,
  // when the Business column went to €65 — the Mercedes EQE 300, which the
  // owner made the Business car — by scripts/sync-db-prices.mts.
  ["pricing-routes-v4"],
  { tags: ["pricing"], revalidate: 3600 }
);

async function getDBRoutes(): Promise<DBRouteRow[] | null> {
  try {
    return await _getRoutesFromDB();
  } catch (err) {
    console.error("[pricing-service] ⚠️  DB read failed — using hardcoded fallback:", err);
    return null;
  }
}

// ── Fixed-price lookup (DB or fallback) ───────────────────────────────────────

async function lookupFixedPrice(
  fromZone: string,
  toZone: string,
  vc: VehicleClass,
  fleetVehicle?: FleetVehicle,
): Promise<number | null> {
  // Same-zone lookups are allowed: the route table is the authority, so a
  // defined same-zone route (e.g. within Barcelona city) resolves normally,
  // and an undefined one still falls through to null → custom quote.
  if (!fromZone || !toZone) return null;

  // A per-car price outranks the database, because the database cannot hold
  // one. It stores five columns per route — Economy, Business, Minivan,
  // V-Class, Minibus — and the Camry, the Tesla, the EQE and the E-Class all
  // read Business while costing €60, €60, €65 and €70. Were the database
  // consulted first here, the fleet page would advertise €60 and the checkout
  // would take €70, which is the exact fault this file exists to prevent.
  if (fleetVehicle) {
    const perCar = perCarPrice(fromZone, toZone, fleetVehicle);
    if (perCar !== null) return perCar;
  }

  // Try DB first — if it has rows and the route is found there, use it
  const rows = await getDBRoutes();
  if (rows && rows.length > 0) {
    const route = rows.find(
      (r) => (r.fromKey === fromZone && r.toKey === toZone) ||
             (r.fromKey === toZone   && r.toKey === fromZone)
    );
    if (route) {
      const code = vehicleCodeForClass(vc);
      if (code) {
        const price = route.prices.find((p) => p.vehicleCode === code)?.price;
        if (price !== undefined) return price;
      }
    }
  }

  // Always fall back to hardcoded routes when DB is empty, unreachable,
  // or the specific route pair isn't stored there yet
  return lookupFixedPriceByZone(fromZone, toZone, vc);
}

/**
 * The per-car price for this route, or null when the car has none.
 *
 * Null means "nothing special about this car here", which sends the caller back
 * to the database and then the column — so adding a car without an override
 * changes no price at all.
 */
function perCarPrice(fromZone: string, toZone: string, fv: FleetVehicle): number | null {
  const from = KEY_TO_ZONE_CODE[fromZone];
  const to   = KEY_TO_ZONE_CODE[toZone];
  if (!from || !to) return null;
  const route = FIXED_ROUTES.find(
    (r) => (r.from === from && r.to === to) || (r.from === to && r.to === from),
  );
  return route?.vehicleOverrides?.[fv] ?? null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns all active routes with prices for the public pricing table. */
export async function getPublicRoutes(): Promise<PublicRoute[]> {
  const rows = await getDBRoutes();

  if (!rows) {
    return FALLBACK_ROUTES.map((r, i) => ({
      id:        `${r.from}-${r.to}`,
      slug:      `${r.from}-${r.to}`,
      label:     r.label,
      category:  r.category,
      fromKey:   r.from,
      toKey:     r.to,
      note:      r.note ?? null,
      sortOrder: i,
      economy:   r.economy,
      business:  r.business,
      minivan:   r.minivan,
      vclass:    r.vclass,
      minibus:   r.minibus,
      updatedAt: new Date(),
    }));
  }

  return rows.map((r) => {
    const byCode = Object.fromEntries(r.prices.map((p) => [p.vehicleCode, p.price]));
    return {
      id:        r.id,
      slug:      r.slug,
      label:     r.label,
      category:  r.category,
      fromKey:   r.fromKey,
      toKey:     r.toKey,
      note:      r.note,
      sortOrder: r.sortOrder,
      economy:   byCode["ECONOMY"]  ?? 0,
      business:  byCode["BUSINESS"] ?? 0,
      minivan:   byCode["MINIVAN"]  ?? 0,
      vclass:    byCode["VCLASS"]   ?? 0,
      minibus:   byCode["MINIBUS"]  ?? 0,
      updatedAt: r.updatedAt,
    };
  });
}

/**
 * The single authoritative path to a customer-facing price.
 *
 * Table first: any route with a row in the fixed table uses that price and
 * never reaches the distance calculation. Routes with no row are priced per
 * kilometre so the customer can still book instantly.
 */
export async function getQuote(input: QuoteInput): Promise<Quote> {
  const {
    pickupLat, pickupLng, dropoffLat, dropoffLng,
    vehicleClass, fleetVehicle, pickupDatetime, distanceKm, durationMin,
    pickupAddress, dropoffAddress,
  } = input;

  const fromZone = resolveEndpointZone(pickupLat, pickupLng, pickupAddress);
  const toZone   = resolveEndpointZone(dropoffLat, dropoffLng, dropoffAddress);

  if (!fromZone || !toZone) {
    console.info(
      `[pricing-custom] zone=null pickup="${pickupAddress ?? `${pickupLat},${pickupLng}`}" dropoff="${dropoffAddress ?? `${dropoffLat},${dropoffLng}`}" vehicle=${vehicleClass}`
    );
    return customRouteQuote(vehicleClass, distanceKm, durationMin);
  }

  const fixedPrice = await lookupFixedPrice(fromZone, toZone, vehicleClass, fleetVehicle);

  if (fixedPrice === null) {
    console.info(
      `[pricing-custom] no-table-row from=${fromZone} to=${toZone} vehicle=${vehicleClass} pickup="${pickupAddress ?? ""}" dropoff="${dropoffAddress ?? ""}"`
    );
    return customRouteQuote(vehicleClass, distanceKm, durationMin);
  }

  // The only direction-aware adjustment in the system. Everything above it
  // matches a route both ways round; this looks at the ordered pair and charges
  // the return leg out of Andorra €20 more than the way there.
  //
  // Folded into baseFare rather than given a field of its own. A new field
  // would have to reach the Booking table to survive to the invoice, and that
  // needs a migration this project has no path for — the schema is pushed, not
  // migrated. The invoice prints baseFare as a single "Base fare" line that has
  // always equalled the total on a fixed-price ride, and it still does.
  const total = fixedPrice + returnLegSurcharge(
    KEY_TO_ZONE_CODE[fromZone],
    KEY_TO_ZONE_CODE[toZone],
  );

  return {
    vehicleClass,
    distanceKm:          Math.round(distanceKm * 10) / 10,
    durationMin,
    baseFare:            total,
    distanceFare:        0,
    airportSurcharge:    0,
    nightSurcharge:      0,
    lastMinuteSurcharge: 0,
    vatAmount:           0,
    totalAmount:         total,
    currency:            "EUR",
    isFixed:             true,
    isCustomRoute:       false,
    fromLabel:           ZONE_LABELS[fromZone],
    toLabel:             ZONE_LABELS[toZone],
  };
}

function hoursUntilPickup(dt: Date): number {
  return (dt.getTime() - Date.now()) / 3_600_000;
}

/**
 * Quote for a journey with no row in the fixed table.
 *
 * Previously returned €0 with isCustomRoute:true, which the booking form turned
 * into "request a quote on WhatsApp" — the customer could not book. Now priced
 * per kilometre so any destination is instantly bookable.
 *
 * isCustomRoute stays true. It no longer means "no price available"; it means
 * "this price came from distance, not the table", which the UI uses to label
 * the quote honestly and which keeps the admin backlog logging intact.
 *
 * When distance is unknown (no dropoff coordinates) there is nothing to price
 * from, so it falls back to €0 and the UI's request-a-quote path — a guessed
 * fare would be worse than asking.
 */
function customRouteQuote(vc: VehicleClass, distanceKm: number, durationMin: number): Quote {
  // Price the car they actually asked for. Without this a V-Class to an unlisted
  // destination cost exactly what a sedan did, while the fixed table charged
  // half as much again for the same upgrade.
  const fare = distanceFare(distanceKm, vehicleCodeForClass(vc) ?? undefined);

  return {
    vehicleClass:        vc,
    distanceKm:          Math.round(distanceKm * 10) / 10,
    durationMin,
    baseFare:            0,
    distanceFare:        fare,
    airportSurcharge:    0,
    nightSurcharge:      0,
    lastMinuteSurcharge: 0,
    vatAmount:           0,
    totalAmount:         fare,
    currency:            "EUR",
    isFixed:             false,
    isCustomRoute:       true,
    // True only when we genuinely could not produce a price.
    needsManualQuote:    fare === 0,
  };
}

/** For admin: read all routes including inactive ones. Never cached. */
export async function getAdminRoutes() {
  return prisma.route.findMany({
    include: { prices: true },
    orderBy: { sortOrder: "asc" },
  });
}

/** For admin: read surcharge settings. */
export async function getPricingSettings() {
  return prisma.pricingSetting.findMany({ orderBy: { key: "asc" } });
}

// Re-export for test parity checks
export { haversineDistance };
