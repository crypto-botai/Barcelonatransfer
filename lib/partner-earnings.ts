import { prisma } from "@/lib/prisma";

/**
 * What a fleet company earned, by day, by week and by month.
 *
 * A ride earns its payout when it is completed, so only completed rides count,
 * and each is placed on the day it ended (the day it was picked up, if the end
 * was never recorded). Days are Barcelona days: a ride that finishes at 00:40
 * belongs to the new day for the people who drove it, whatever UTC says.
 *
 * Pure apart from the one query at the bottom, so the bucketing can be tested
 * without a database.
 */

export type EarningsView = "day" | "week" | "month";

export const EARNINGS_VIEWS: EarningsView[] = ["day", "week", "month"];

/** How many buckets each view shows: two weeks, two months, half a year. */
export const BUCKET_COUNT: Record<EarningsView, number> = { day: 14, week: 8, month: 6 };

export interface EarningsRide {
  /** When the ride ended, or failing that when it was due to start. */
  at: Date | string;
  partnerPayout: number | null;
  driverAmount: number | null;
}

export interface EarningsBucket {
  /** Stable key: the day, the Monday, or the first of the month, as YYYY-MM-DD. */
  key: string;
  label: string;
  /** A longer label for a tooltip or a table row. */
  title: string;
  rides: number;
  earned: number;
  /** What the drivers were told they would be paid on these rides. */
  toDrivers: number;
  /** What the company keeps: payout less the drivers' share. */
  kept: number;
  /** The bucket containing now. */
  current: boolean;
}

export interface EarningsSeries {
  view: EarningsView;
  buckets: EarningsBucket[];
  totals: { rides: number; earned: number; toDrivers: number; kept: number };
  /** The best bucket, so the chart can say what a good one looks like. */
  best: { key: string; earned: number } | null;
}

const ZONE = "Europe/Madrid";
const DAY_MS = 86_400_000;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A moment as its Barcelona calendar date. */
export function madridDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: ZONE });
}

/** Calendar arithmetic on a YYYY-MM-DD string, done in UTC so no clock change can move it. */
function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -dow);
}

function addMonths(first: string, n: number): string {
  const [y, m] = first.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** The bucket a date falls in, for this view. */
function bucketKey(date: string, view: EarningsView): string {
  if (view === "day") return date;
  if (view === "week") return mondayOf(date);
  return `${date.slice(0, 7)}-01`;
}

const fmt = (key: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

function labels(key: string, view: EarningsView): { label: string; title: string } {
  if (view === "day") return { label: fmt(key, { day: "numeric" }), title: fmt(key, { weekday: "long", day: "numeric", month: "long" }) };
  if (view === "week") {
    const end = addDays(key, 6);
    return { label: fmt(key, { day: "numeric", month: "short" }), title: `${fmt(key, { day: "numeric", month: "short" })} to ${fmt(end, { day: "numeric", month: "short" })}` };
  }
  return { label: fmt(key, { month: "short" }), title: fmt(key, { month: "long", year: "numeric" }) };
}

/** The first day shown for a view: the oldest bucket a full series reaches back to. */
export function seriesStart(view: EarningsView, now: Date = new Date()): string {
  const today = madridDate(now);
  const n = BUCKET_COUNT[view] - 1;
  if (view === "day") return addDays(today, -n);
  if (view === "week") return addDays(mondayOf(today), -7 * n);
  return addMonths(`${today.slice(0, 7)}-01`, -n);
}

export function buildEarningsSeries(rides: EarningsRide[], view: EarningsView, now: Date = new Date()): EarningsSeries {
  const today = madridDate(now);
  const start = seriesStart(view, now);

  const keys: string[] = [];
  for (let i = 0; i < BUCKET_COUNT[view]; i++) {
    keys.push(view === "day" ? addDays(start, i) : view === "week" ? addDays(start, 7 * i) : addMonths(start, i));
  }

  const acc = new Map<string, { rides: number; earned: number; toDrivers: number }>(keys.map((k) => [k, { rides: 0, earned: 0, toDrivers: 0 }]));
  for (const r of rides) {
    const slot = acc.get(bucketKey(madridDate(r.at), view));
    if (!slot) continue; // before the window, or in the future
    slot.rides += 1;
    slot.earned += r.partnerPayout ?? 0;
    slot.toDrivers += r.driverAmount ?? 0;
  }

  const currentKey = bucketKey(today, view);
  const buckets: EarningsBucket[] = keys.map((key) => {
    const s = acc.get(key)!;
    return {
      key, ...labels(key, view),
      rides: s.rides, earned: round2(s.earned), toDrivers: round2(s.toDrivers),
      // A ride with no driver figure keeps all of its payout.
      kept: round2(s.earned - s.toDrivers),
      current: key === currentKey,
    };
  });

  const sum = (f: (b: EarningsBucket) => number) => round2(buckets.reduce((t, b) => t + f(b), 0));
  const best = buckets.reduce<EarningsBucket | null>((m, b) => (b.earned > 0 && (!m || b.earned > m.earned) ? b : m), null);

  return {
    view, buckets,
    totals: { rides: buckets.reduce((t, b) => t + b.rides, 0), earned: sum((b) => b.earned), toDrivers: sum((b) => b.toDrivers), kept: sum((b) => b.kept) },
    best: best ? { key: best.key, earned: best.earned } : null,
  };
}

/** The company's completed rides over the window the view shows, bucketed. */
export async function partnerEarnings(partnerId: string, view: EarningsView, now: Date = new Date()): Promise<EarningsSeries> {
  // A day of slack either side of the window: a bucket edge is a Barcelona
  // midnight, and the query is in UTC.
  const from = new Date(new Date(`${seriesStart(view, now)}T00:00:00Z`).getTime() - DAY_MS);
  const rows = await prisma.booking.findMany({
    where: {
      partnerId, isDeleted: false, status: "COMPLETED",
      OR: [{ rideEndedAt: { gte: from } }, { rideEndedAt: null, pickupDatetime: { gte: from } }],
    },
    select: { rideEndedAt: true, pickupDatetime: true, partnerPayout: true, driverAmount: true },
    take: 5000,
  });
  return buildEarningsSeries(
    rows.map((r) => ({ at: r.rideEndedAt ?? r.pickupDatetime, partnerPayout: r.partnerPayout, driverAmount: r.driverAmount })),
    view,
    now,
  );
}
