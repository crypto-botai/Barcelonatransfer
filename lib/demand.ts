import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ZONE_LABELS, detectZoneFromCoords, resolveZoneStrict } from "@/lib/pricing";
import { weekendOf } from "@/lib/weekend-pricing";

/**
 * Which areas are busy, for the customer booking.
 *
 * "High demand" and "low demand" are shown beside the pick-up and the drop-off
 * while someone books, so the price they are given reads as what it is: a fare
 * for a place and a time that is in demand, or is not.
 *
 * Where it comes from. Each area is ranked by how many of the last 90 days of
 * real bookings began or ended there. The busiest fifth are high demand, the
 * quietest two fifths are low, and the rest are not labelled at all, because a
 * label on everything says nothing. Until there are enough bookings to rank
 * honestly, a fixed list stands in, so the label never rests on three rides.
 *
 * Time moves it too. Inside a weekend (Friday noon to Monday noon) every area is
 * one step busier, because that is when cars are scarce everywhere: a quiet
 * area becomes ordinary, an ordinary one becomes high demand.
 *
 * The labels never carry a percentage or a price. They say how busy, nothing
 * about what it costs.
 */

export type DemandLevel = "high" | "normal" | "low";

export interface AreaDemand {
  /** The area, as the quote names it ("Barcelona City"). */
  label: string;
  level: DemandLevel;
}

export interface QuoteDemand {
  pickup: AreaDemand | null;
  dropoff: AreaDemand | null;
}

/** Busy on any ordinary week, before there is data to say otherwise. */
export const BASELINE_HIGH: readonly string[] = ["airport", "barcelona_city", "cruise", "sants", "sitges", "castelldefels"];
/** Quiet on any ordinary week: long runs out of the city, and small stretches of coast. */
export const BASELINE_LOW: readonly string[] = ["lourdes", "andorra", "cadaques", "figueres", "empuriabrava", "cubelles", "calafell", "vendrell", "malgrat", "santa_susanna"];

/** Fewer bookings than this and the ranking would be noise. */
export const MIN_BOOKINGS_TO_RANK = 40;
/** An area needs at least this many to be called high demand on the data. */
export const MIN_BOOKINGS_FOR_HIGH = 3;
export const DEMAND_DAYS = 90;

const ZONES = Object.keys(ZONE_LABELS);

const baseline = (): Record<string, DemandLevel> =>
  Object.fromEntries(ZONES.map((z) => [z, BASELINE_HIGH.includes(z) ? "high" : BASELINE_LOW.includes(z) ? "low" : "normal"] as const));

/**
 * Every area's level from how many bookings touched it. Pure.
 *
 * `counts` is bookings per area (a ride from the airport to Sitges counts once
 * for each). Too few bookings in all, and the fixed list is used.
 */
export function levelsFromCounts(counts: Record<string, number>, zones: readonly string[] = ZONES): Record<string, DemandLevel> {
  const total = zones.reduce((t, z) => t + (counts[z] ?? 0), 0);
  if (total < MIN_BOOKINGS_TO_RANK) return baseline();

  const ranked = [...zones].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));
  const highN = Math.max(3, Math.round(zones.length * 0.2));
  const lowN = Math.round(zones.length * 0.4);

  const levels: Record<string, DemandLevel> = Object.fromEntries(zones.map((z) => [z, "normal"] as const));
  ranked.slice(0, highN).forEach((z) => { if ((counts[z] ?? 0) >= MIN_BOOKINGS_FOR_HIGH) levels[z] = "high"; });
  // Low is everything at or under the count where the quietest two fifths begin, so areas
  // tied on the same number (most often zero) are all low or none is, never half of them.
  const cut = counts[ranked[Math.max(0, zones.length - lowN)]] ?? 0;
  zones.forEach((z) => { if (levels[z] !== "high" && (counts[z] ?? 0) <= cut) levels[z] = "low"; });
  return levels;
}

/** One step busier inside a weekend. */
export function busier(level: DemandLevel): DemandLevel {
  return level === "low" ? "normal" : "high";
}

/**
 * How busy an area is for this pickup moment. Null for an area we do not
 * recognise, and null for an ordinary one: only high and low are said.
 */
export function demandFor(zone: string | null | undefined, levels: Record<string, DemandLevel>, pickup: Date | string): AreaDemand | null {
  if (!zone || !ZONE_LABELS[zone]) return null;
  const base = levels[zone] ?? "normal";
  const level = weekendOf(pickup) ? busier(base) : base;
  return level === "normal" ? null : { label: ZONE_LABELS[zone], level };
}

const zoneOf = (lat: number | null, lng: number | null, address: string | null): string | null =>
  (address ? resolveZoneStrict(address) : null) ?? (lat && lng ? detectZoneFromCoords(lat, lng) : null);

const loadLevels = unstable_cache(
  async (): Promise<Record<string, DemandLevel>> => {
    const since = new Date(Date.now() - DEMAND_DAYS * 86_400_000);
    const rows = await prisma.booking.findMany({
      where: { isDeleted: false, status: { notIn: ["CANCELLED", "REFUNDED"] }, createdAt: { gte: since } },
      select: { pickupAddress: true, pickupLat: true, pickupLng: true, dropoffAddress: true, dropoffLat: true, dropoffLng: true },
      take: 5000,
    });
    const counts: Record<string, number> = {};
    for (const r of rows) {
      for (const z of [zoneOf(r.pickupLat, r.pickupLng, r.pickupAddress), zoneOf(r.dropoffLat, r.dropoffLng, r.dropoffAddress)]) {
        if (z) counts[z] = (counts[z] ?? 0) + 1;
      }
    }
    return levelsFromCounts(counts);
  },
  // Demand moves slowly: a few hours is fresh enough, and a quote must never wait on this.
  ["demand-zones-v1"],
  { tags: ["demand"], revalidate: 6 * 3600 },
);

/** The levels, from the data when it can be read and from the fixed list when it cannot. Never throws. */
export async function zoneLevels(): Promise<Record<string, DemandLevel>> {
  try {
    return await loadLevels();
  } catch {
    return baseline();
  }
}

/** Both ends of a journey, for this pickup moment. */
export async function quoteDemand(fromZone: string | null, toZone: string | null, pickup: Date): Promise<QuoteDemand | undefined> {
  if (!fromZone && !toZone) return undefined;
  const levels = await zoneLevels();
  const d: QuoteDemand = { pickup: demandFor(fromZone, levels, pickup), dropoff: demandFor(toZone, levels, pickup) };
  return d.pickup || d.dropoff ? d : undefined;
}
