import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ session: null as null | { user: { role: string } } }));
vi.mock("next-auth", () => ({ getServerSession: async () => state.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/geo", () => ({
  resolveEndpoint: async (lat?: number, lng?: number) => (lat && lng ? { lat, lng } : null),
  roadDistance: async () => ({ distanceKm: 18.4, durationMin: 24, precise: true }),
}));
vi.mock("@/lib/geo/live-route", () => ({ liveRoute: async () => ({ distanceKm: 18.4, durationMin: 24, coordinates: [[2.07, 41.29], [2.17, 41.38]], basis: "road-network" }) }));
const getQuote = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pricing-service", () => ({ getQuote }));

import { POST } from "@/app/api/admin/price-calculator/route";

const call = (body: unknown) => POST(new Request("http://x/api/admin/price-calculator", { method: "POST", body: JSON.stringify(body) }) as never);
const good = { pickup: { lat: 41.29, lng: 2.07, address: "Airport" }, dropoff: { lat: 41.38, lng: 2.17, address: "Hotel Arts" }, pickupDatetime: "2026-10-20T14:30" };

beforeEach(() => {
  state.session = { user: { role: "ADMIN" } };
  getQuote.mockReset();
  getQuote.mockResolvedValue({ totalAmount: 55, isFixed: true, needsManualQuote: false, fromLabel: "El Prat Airport", toLabel: "Barcelona City" });
});

describe("admin price calculator", () => {
  it("refuses anyone who is not an admin", async () => {
    state.session = { user: { role: "CUSTOMER" } };
    expect((await call(good)).status).toBe(401);
    state.session = null;
    expect((await call(good)).status).toBe(401);
    expect(getQuote).not.toHaveBeenCalled();
  });

  it("prices every car through the checkout's own getQuote and returns the route", async () => {
    const r = await call(good);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.quotes).toHaveLength(7);
    expect(getQuote).toHaveBeenCalledTimes(7);
    expect(j.quotes[0]).toMatchObject({ total: 55, basis: "table", fromLabel: "El Prat Airport" });
    expect(j.distanceKm).toBe(18.4);
    expect(j.routeCoordinates).toHaveLength(2);
  });

  it("labels a distance price and a no-price result", async () => {
    getQuote.mockResolvedValueOnce({ totalAmount: 90, isFixed: false, needsManualQuote: false }).mockResolvedValueOnce({ totalAmount: 0, isFixed: false, needsManualQuote: true });
    const j = await (await call(good)).json();
    expect(j.quotes[0].basis).toBe("distance");
    expect(j.quotes[1].basis).toBe("none");
  });

  it("422s when a place cannot be found, 400s on junk", async () => {
    expect((await call({ ...good, dropoff: { address: "" } })).status).toBe(422);
    expect((await call({ nope: 1 })).status).toBe(400);
  });
});
