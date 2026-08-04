/**
 * pricing-service.ts — the ONLY path to a customer-facing price.
 *
 * getQuote() either returns a fixed table price or isCustomRoute:true.
 * It NEVER returns a calculated/distance-based price.
 *
 * Zone resolution order (for each endpoint):
 *  1. Text-based resolveZone() on the address string (most accurate)
 *  2. Coordinate-based detectZoneFromCoords() as fallback
 *  3. null → isCustomRoute: true → UI shows "request a quote"
 *
 * Cache: tagged "pricing" so revalidateTag("pricing") flushes on admin save.
 * Fallback: if the DB is unreachable, falls back to ROUTES from lib/pricing.ts.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ROUTES as FALLBACK_ROUTES,
  ZONE_LABELS,
  resolveZone,
  detectZoneFromCoords,
  vehicleCodeForClass,
  lookupFixedPriceByZone,
} from "@/lib/pricing";
import { haversineDistance } from "@/lib/utils";
import type { VehicleClass } from "@/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PublicRoute {
  id:        string;
  slug:      string;
  label:     string;
  category:  string;
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
  isCustomRoute:         boolean;  // true = route not in table, never show a price
  fromLabel?:            string;   // e.g. "El Prat Airport"
  toLabel?:              string;   // e.g. "Barcelona City"
}

// ── Zone resolution ───────────────────────────────────────────────────────────

function resolveEndpointZone(lat: number, lng: number, address?: string): string | null {
  // 1. Text-based first (more accurate for named places and destinations)
  if (address) {
    const z = resolveZone(address);
    if (z) return z;
  }
  // 2. Coordinate-based fallback
  return detectZoneFromCoords(lat, lng);
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
  ["pricing-routes"],
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
): Promise<number | null> {
  // Same-zone lookups are allowed: the route table is the authority, so a
  // defined same-zone route (e.g. within Barcelona city) resolves normally,
  // and an undefined one still falls through to null → custom quote.
  if (!fromZone || !toZone) return null;

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
 * Returns a Quote with isCustomRoute:true when the route is not in the table.
 * NEVER falls back to distance-based pricing.
 */
export async function getQuote(input: QuoteInput): Promise<Quote> {
  const {
    pickupLat, pickupLng, dropoffLat, dropoffLng,
    vehicleClass, pickupDatetime, distanceKm, durationMin,
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

  const fixedPrice = await lookupFixedPrice(fromZone, toZone, vehicleClass);

  if (fixedPrice === null) {
    console.info(
      `[pricing-custom] no-table-row from=${fromZone} to=${toZone} vehicle=${vehicleClass} pickup="${pickupAddress ?? ""}" dropoff="${dropoffAddress ?? ""}"`
    );
    return customRouteQuote(vehicleClass, distanceKm, durationMin);
  }

  return {
    vehicleClass,
    distanceKm:          Math.round(distanceKm * 10) / 10,
    durationMin,
    baseFare:            fixedPrice,
    distanceFare:        0,
    airportSurcharge:    0,
    nightSurcharge:      0,
    lastMinuteSurcharge: 0,
    vatAmount:           0,
    totalAmount:         fixedPrice,
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

function customRouteQuote(vc: VehicleClass, distanceKm: number, durationMin: number): Quote {
  return {
    vehicleClass:        vc,
    distanceKm:          Math.round(distanceKm * 10) / 10,
    durationMin,
    baseFare:            0,
    distanceFare:        0,
    airportSurcharge:    0,
    nightSurcharge:      0,
    lastMinuteSurcharge: 0,
    vatAmount:           0,
    totalAmount:         0,
    currency:            "EUR",
    isFixed:             false,
    isCustomRoute:       true,
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
