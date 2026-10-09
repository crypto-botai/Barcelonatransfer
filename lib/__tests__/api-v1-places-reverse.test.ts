import { describe, it, expect, vi, beforeEach } from "vitest";

const geo = vi.hoisted(() => ({ result: null as null | Record<string, unknown>, calls: 0 }));
vi.mock("@/lib/geo", () => ({
  reversePlace: async (lat: number, lng: number) => {
    geo.calls++;
    return geo.result ? { ...geo.result, lat, lng } : null;
  },
}));

import { MemoryRateLimiter, setRateLimiter } from "@/lib/api/v1/rate-limit";
import { setAuditSink } from "@/lib/api/v1/audit";
import { GET as reverse } from "@/app/api/v1/places/reverse/route";

const get = async (qs: string) => {
  const res = await reverse(new Request(`https://x.test/api/v1/places/reverse?${qs}`), { params: Promise.resolve({}) } as never);
  return { status: res.status, json: await res.json() };
};

beforeEach(() => {
  setRateLimiter(new MemoryRateLimiter());
  setAuditSink(async () => undefined);
  geo.calls = 0;
  geo.result = { name: "Hotel Arts Barcelona", context: "Carrer de la Marina, Barcelona", label: "Hotel Arts Barcelona, Carrer de la Marina, Barcelona", kind: "hotel" };
});

describe("GET /api/v1/places/reverse", () => {
  it("names the place and keeps the point the person chose", async () => {
    const { status, json } = await get("lat=41.3869&lng=2.1966");
    expect(status).toBe(200);
    expect(json.data.place).toMatchObject({ name: "Hotel Arts Barcelona", lat: 41.3869, lng: 2.1966 });
  });

  it("is public and refuses a point outside where the business drives, without asking a geocoder", async () => {
    expect((await get("lat=48.85&lng=2.35")).status).toBe(422); // Paris
    expect((await get("lat=0&lng=0")).status).toBe(422);
    expect((await get("lat=abc&lng=2")).status).toBe(422);
    expect((await get("lat=41.4")).status).toBe(422);
    expect(geo.calls).toBe(0);
  });

  it("says so, plainly, when nothing can be named there", async () => {
    geo.result = null;
    const { status, json } = await get("lat=41.5&lng=2.2");
    expect(status).toBe(404);
    expect(json.error.code).toBe("NOT_FOUND");
    expect(json.error.message).toMatch(/Move the pin/);
  });
});
