import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ partner: { id: "p1", name: "Costa Cars" } as { id: string; name: string } | null, findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { booking: { findMany: m.findMany } } }));
vi.mock("@/lib/partner", () => ({ requirePartner: async () => m.partner }));

import { buildEarningsSeries, madridDate, partnerEarnings, seriesStart } from "@/lib/partner-earnings";
import { GET as earningsGet } from "@/app/api/partner/earnings/route";
import { GET as flightsGet } from "@/app/api/partner/flights/route";

/**
 * The company's daily, weekly and monthly earnings.
 *
 * What must hold: a ride lands on its Barcelona day (not the UTC one), only
 * rides inside the window count, the week starts on Monday, the company's
 * margin is its payout less what it told its drivers, and no route sends a
 * fare.
 */

// Wednesday 14 October 2026, midday in Barcelona (CEST, UTC+2).
const NOW = new Date("2026-10-14T10:00:00Z");
const ride = (at: string, payout: number | null, driver: number | null = null) => ({ at, partnerPayout: payout, driverAmount: driver });

describe("the window each view shows", () => {
  it("is two weeks of days, eight weeks, six months, ending now", () => {
    const d = buildEarningsSeries([], "day", NOW);
    expect(d.buckets).toHaveLength(14);
    expect(d.buckets[0].key).toBe("2026-10-01");
    expect(d.buckets[13]).toMatchObject({ key: "2026-10-14", current: true });

    const w = buildEarningsSeries([], "week", NOW);
    expect(w.buckets).toHaveLength(8);
    expect(w.buckets[7]).toMatchObject({ key: "2026-10-12", current: true }); // a Monday
    expect(w.buckets[0].key).toBe("2026-08-24");

    const mo = buildEarningsSeries([], "month", NOW);
    expect(mo.buckets.map((b) => b.key)).toEqual(["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(mo.buckets[5].current).toBe(true);
  });

  it("marks exactly one bucket as the current one", () => {
    for (const v of ["day", "week", "month"] as const) expect(buildEarningsSeries([], v, NOW).buckets.filter((b) => b.current)).toHaveLength(1);
  });

  it("works across a year boundary and a clock change", () => {
    const jan = buildEarningsSeries([], "month", new Date("2027-01-10T10:00:00Z"));
    expect(jan.buckets.map((b) => b.key)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01"]);
    // Clocks went back on Sunday 25 October 2026: every day is still one bucket, in order.
    const days = buildEarningsSeries([], "day", new Date("2026-10-30T10:00:00Z")).buckets.map((b) => b.key);
    expect(new Set(days).size).toBe(14);
    expect(days).toContain("2026-10-25");
  });

  it("seriesStart is the oldest bucket, which is what the query reaches back to", () => {
    expect(seriesStart("day", NOW)).toBe("2026-10-01");
    expect(seriesStart("week", NOW)).toBe("2026-08-24");
    expect(seriesStart("month", NOW)).toBe("2026-05-01");
  });
});

describe("which day a ride belongs to", () => {
  it("is its Barcelona day, not the UTC one", () => {
    // 23:30 UTC on the 13th is 01:30 on the 14th in Barcelona.
    expect(madridDate("2026-10-13T23:30:00Z")).toBe("2026-10-14");
    const s = buildEarningsSeries([ride("2026-10-13T23:30:00Z", 50)], "day", NOW);
    expect(s.buckets.find((b) => b.key === "2026-10-14")).toMatchObject({ rides: 1, earned: 50 });
    expect(s.buckets.find((b) => b.key === "2026-10-13")).toMatchObject({ rides: 0, earned: 0 });
  });

  it("puts Sunday in the week that began the Monday before, and Monday in the next", () => {
    const s = buildEarningsSeries([ride("2026-10-11T12:00:00Z", 40), ride("2026-10-12T08:00:00Z", 60)], "week", NOW);
    expect(s.buckets.find((b) => b.key === "2026-10-05")).toMatchObject({ rides: 1, earned: 40 });
    expect(s.buckets.find((b) => b.key === "2026-10-12")).toMatchObject({ rides: 1, earned: 60 });
  });

  it("groups a month together", () => {
    const s = buildEarningsSeries([ride("2026-09-01T09:00:00Z", 30), ride("2026-09-30T20:00:00Z", 70), ride("2026-10-02T09:00:00Z", 10)], "month", NOW);
    expect(s.buckets.find((b) => b.key === "2026-09-01")).toMatchObject({ rides: 2, earned: 100 });
    expect(s.buckets.find((b) => b.key === "2026-10-01")).toMatchObject({ rides: 1, earned: 10 });
  });

  it("leaves out rides before the window and ones in the future", () => {
    const s = buildEarningsSeries([ride("2026-09-20T09:00:00Z", 99), ride("2026-10-20T09:00:00Z", 99), ride("2026-10-10T09:00:00Z", 25)], "day", NOW);
    expect(s.totals).toMatchObject({ rides: 1, earned: 25 });
  });
});

describe("the money", () => {
  it("keeps what is left of the payout after the drivers", () => {
    const s = buildEarningsSeries([ride("2026-10-14T08:00:00Z", 100, 70), ride("2026-10-14T09:00:00Z", 50, 35)], "day", NOW);
    expect(s.buckets[13]).toMatchObject({ rides: 2, earned: 150, toDrivers: 105, kept: 45 });
    expect(s.totals).toEqual({ rides: 2, earned: 150, toDrivers: 105, kept: 45 });
  });

  it("keeps the whole payout of a ride whose driver figure was never set", () => {
    const s = buildEarningsSeries([ride("2026-10-14T08:00:00Z", 80, null)], "day", NOW);
    expect(s.buckets[13]).toMatchObject({ earned: 80, toDrivers: 0, kept: 80 });
  });

  it("does not drift on cents", () => {
    const s = buildEarningsSeries([ride("2026-10-14T08:00:00Z", 0.1), ride("2026-10-14T08:10:00Z", 0.2)], "day", NOW);
    expect(s.totals.earned).toBe(0.3);
  });

  it("names the best period, and has none when nothing was earned", () => {
    const s = buildEarningsSeries([ride("2026-10-12T08:00:00Z", 40), ride("2026-10-13T08:00:00Z", 90)], "day", NOW);
    expect(s.best).toEqual({ key: "2026-10-13", earned: 90 });
    expect(buildEarningsSeries([], "day", NOW).best).toBeNull();
  });

  it("gives each bucket a label short enough for a bar and a title for the table", () => {
    const s = buildEarningsSeries([], "day", NOW);
    expect(s.buckets[13].label).toBe("14");
    expect(s.buckets[13].title).toBe("Wednesday 14 October");
    expect(buildEarningsSeries([], "week", NOW).buckets[7].title).toBe("12 Oct to 18 Oct");
    expect(buildEarningsSeries([], "month", NOW).buckets[5]).toMatchObject({ label: "Oct", title: "October 2026" });
  });
});

describe("reading the company's rides", () => {
  beforeEach(() => { m.partner = { id: "p1", name: "Costa Cars" }; m.findMany.mockReset(); m.findMany.mockResolvedValue([]); });

  it("asks only for this company's completed rides, and reaches back no further than the window", async () => {
    await partnerEarnings("p1", "day", NOW);
    const q = m.findMany.mock.calls[0][0];
    expect(q.where).toMatchObject({ partnerId: "p1", isDeleted: false, status: "COMPLETED" });
    const floor = q.where.OR[0].rideEndedAt.gte as Date;
    expect(floor.getTime()).toBeLessThan(new Date("2026-10-01T00:00:00Z").getTime());
    expect(floor.getTime()).toBeGreaterThan(new Date("2026-09-25T00:00:00Z").getTime());
  });

  it("dates a ride by when it ended, and by its pick-up if the end was never recorded", async () => {
    m.findMany.mockResolvedValue([
      { rideEndedAt: new Date("2026-10-13T23:30:00Z"), pickupDatetime: new Date("2026-10-13T20:00:00Z"), partnerPayout: 50, driverAmount: 30 },
      { rideEndedAt: null, pickupDatetime: new Date("2026-10-10T09:00:00Z"), partnerPayout: 20, driverAmount: null },
    ]);
    const s = await partnerEarnings("p1", "day", NOW);
    expect(s.buckets.find((b) => b.key === "2026-10-14")).toMatchObject({ earned: 50, kept: 20 });
    expect(s.buckets.find((b) => b.key === "2026-10-10")).toMatchObject({ earned: 20, kept: 20 });
  });
});

describe("the earnings route", () => {
  beforeEach(() => { m.partner = { id: "p1", name: "Costa Cars" }; m.findMany.mockReset(); m.findMany.mockResolvedValue([]); });
  const req = (view?: string) => ({ nextUrl: new URL(`http://x/api/partner/earnings${view ? `?view=${view}` : ""}`) }) as never;

  it("is for a signed-in company only", async () => {
    m.partner = null;
    expect((await earningsGet(req("day"))).status).toBe(401);
    expect(m.findMany).not.toHaveBeenCalled();
  });

  it("answers day, week and month, and day when none is given", async () => {
    for (const v of ["day", "week", "month"]) {
      const res = await earningsGet(req(v));
      expect(res.status).toBe(200);
      expect((await res.json()).view).toBe(v);
    }
    expect((await (await earningsGet(req())).json()).view).toBe("day");
  });

  it("refuses a period it does not have", async () => {
    expect((await earningsGet(req("year"))).status).toBe(422);
    expect(m.findMany).not.toHaveBeenCalled();
  });
});

describe("the flights route", () => {
  beforeEach(() => { m.partner = { id: "p1", name: "Costa Cars" }; m.findMany.mockReset(); });

  it("is for a signed-in company only", async () => {
    m.partner = null;
    expect((await flightsGet()).status).toBe(401);
    expect(m.findMany).not.toHaveBeenCalled();
  });

  it("lists this company's open jobs that have a flight, soonest first, over a bounded window", async () => {
    m.findMany.mockResolvedValue([]);
    await flightsGet();
    const q = m.findMany.mock.calls[0][0];
    expect(q.where).toMatchObject({ partnerId: "p1", isDeleted: false, flightNumber: { not: null }, status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] } });
    expect(q.orderBy).toEqual({ pickupDatetime: "asc" });
    expect(q.where.pickupDatetime.lte.getTime() - q.where.pickupDatetime.gte.getTime()).toBeLessThan(8 * 86_400_000);
    expect(q.take).toBeLessThanOrEqual(200);
  });

  it("asks for no money at all", async () => {
    m.findMany.mockResolvedValue([]);
    await flightsGet();
    const keys = Object.keys(m.findMany.mock.calls[0][0].select);
    for (const forbidden of ["totalAmount", "partnerPayout", "driverAmount", "paymentStatus", "paymentMethod", "balanceAmount", "specialRequests", "guestEmail"]) expect(keys).not.toContain(forbidden);
  });

  it("drops a job whose flight number is only spaces", async () => {
    m.findMany.mockResolvedValue([{ id: "a", flightNumber: "IB3456" }, { id: "b", flightNumber: "   " }]);
    const body = await (await flightsGet()).json();
    expect(body.jobs.map((j: { id: string }) => j.id)).toEqual(["a"]);
  });
});
