import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: () => undefined }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: () => new Proxy({}, { get: () => async () => [] }) }) }));

import { routeLanding } from "@/lib/route-landings";
import { getQuote } from "@/lib/pricing-service";

/**
 * The Tarragona cruise port page quotes no fare of its own: it reads the Tarragona ladder. These pin that the page and the
 * checkout agree, and that an address at the port is priced as Tarragona.
 */
const AIRPORT = { lat: 41.2974, lng: 2.0833, address: "Barcelona Airport El Prat Terminal 1" };
const TARRAGONA_PORT = { lat: 41.1075, lng: 1.24, address: "Port de Tarragona, Moll de Balears, Tarragona" };

describe("Tarragona cruise port page", () => {
  const page = routeLanding("tarragona-cruise-port")!;

  it("is registered and well formed", () => {
    expect(page).toBeDefined();
    expect(page.title).toContain(`€${page.cheapest}`);
    expect(page.title.length).toBeLessThanOrEqual(60);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(page.faqs.length).toBeGreaterThanOrEqual(5);
    expect(page.url).toBe("https://www.elitebcn.info/transfers/tarragona-cruise-port");
  });

  it("advertises what the checkout charges from the airport to the port", async () => {
    const q = await getQuote({
      pickupLat: AIRPORT.lat, pickupLng: AIRPORT.lng, pickupAddress: AIRPORT.address,
      dropoffLat: TARRAGONA_PORT.lat, dropoffLng: TARRAGONA_PORT.lng, dropoffAddress: TARRAGONA_PORT.address,
      vehicleClass: "ECONOMY", pickupDatetime: new Date("2026-11-04T10:00:00+01:00"), distanceKm: 95, durationMin: 65,
    } as never);
    const economy = page.priceTables[0].vehicles[0].price;
    expect(q.needsManualQuote).toBeFalsy();
    expect(q.totalAmount).toBe(economy);
  });
});
