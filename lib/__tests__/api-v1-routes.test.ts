import { describe, it, expect, vi, beforeEach } from "vitest";

const table = vi.hoisted(() => ({
  rows: [] as Array<Record<string, any>>,
}));

// The website's own price table is read through getPublicRoutes. Replacing it here stands in for the admin editing a price.
vi.mock("@/lib/pricing-service", () => ({ getPublicRoutes: async () => table.rows }));

import { MemoryRateLimiter, setRateLimiter } from "@/lib/api/v1/rate-limit";
import { setAuditSink } from "@/lib/api/v1/audit";
import { GET as routes } from "@/app/api/v1/routes/route";

const row = (over: Record<string, any> = {}) => ({
  id: "r1",
  slug: "bcn-airport-barcelona-city",
  label: "El Prat Airport to Barcelona City",
  category: "airport-city",
  fromKey: "BCN_AIRPORT",
  toKey: "BARCELONA_CITY",
  note: null,
  sortOrder: 1,
  economy: 50,
  business: 65,
  minivan: 65,
  vclass: 75,
  minibus: 200,
  updatedAt: new Date("2026-10-01T10:00:00Z"),
  ...over,
});

const get = async () => {
  const res = await routes(new Request("https://x.test/api/v1/routes"), { params: Promise.resolve({}) } as never);
  return { status: res.status, json: await res.json() };
};

beforeEach(() => {
  setRateLimiter(new MemoryRateLimiter());
  setAuditSink(async () => undefined);
  table.rows = [row(), row({ id: "r2", slug: "bcn-airport-sitges", label: "El Prat Airport to Sitges", category: "costa-dorada", toKey: "SITGES", sortOrder: 0, economy: 70, business: 85, minivan: 95, vclass: 110, minibus: 240 })];
});

describe("GET /api/v1/routes", () => {
  it("is public and lists every route with its price per class, in the table's order", async () => {
    const { status, json } = await get();
    expect(status).toBe(200);
    expect(json.data.routes.map((r: any) => r.slug)).toEqual(["bcn-airport-sitges", "bcn-airport-barcelona-city"]);
    expect(json.data.routes[1].prices).toEqual({ ECONOMY: 50, BUSINESS: 65, MINIVAN: 65, VCLASS: 75, MINIBUS: 200 });
    expect(json.data.classes.map((c: any) => c.code)).toEqual(["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"]);
  });

  it("a price changed in the table (the admin) is what the next request returns", async () => {
    expect((await get()).json.data.routes[1].prices.VCLASS).toBe(75);
    table.rows[0] = row({ vclass: 80 });
    expect((await get()).json.data.routes.find((r: any) => r.slug === "bcn-airport-barcelona-city").prices.VCLASS).toBe(80);
  });

  it("carries nothing private: no ids of customers, no costs, only the public table's fields", async () => {
    const r = (await get()).json.data.routes[0];
    expect(Object.keys(r).sort()).toEqual(["category", "fromKey", "id", "label", "note", "prices", "slug", "toKey", "updatedAt"]);
  });
});
