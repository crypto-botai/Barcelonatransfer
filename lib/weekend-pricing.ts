/**
 * Weekend pricing.
 *
 * A weekend runs from Friday 12:00 to Monday 12:00, Barcelona time, and is
 * judged by when the car is wanted, never by when the booking was made. A
 * booking made in March for a Saturday in June pays the June weekend price.
 *
 * Every transfer picked up inside a weekend costs more by one percentage, the
 * same for every route that weekend, somewhere from 15% to 22%. The percentage
 * is chosen once per weekend from its date, so it looks random from one weekend
 * to the next but never changes for a given one. That is what makes it safe: two
 * customers quoted for the same Saturday get the same rule, the quote shown on
 * Tuesday is the quote charged on Thursday, and a quote that is asked for twice
 * cannot be shopped for a lower number.
 *
 * The customer is shown the price, never the percentage. The uplift is folded
 * into the fare (lib/pricing-service.ts), so it reaches every surface that
 * reads a quote without any of them knowing it exists.
 *
 * Do not change WEEKEND_SALT, the range, or the mixing below. Quotes already
 * given and bookings already taken for future weekends were priced with them,
 * and changing them would move every future weekend's percentage.
 *
 * Pure: no database, no clock except the one passed in.
 */

export const WEEKEND_MIN_PERCENT = 15;
export const WEEKEND_MAX_PERCENT = 22;

/** Friday, from this hour (Barcelona time). */
export const WEEKEND_START_HOUR = 12;
/** Monday, until this hour (Barcelona time). */
export const WEEKEND_END_HOUR = 12;

const WEEKEND_SALT = "elitebcn-weekend-v1";
const ZONE = "Europe/Madrid";
const DAY_MS = 86_400_000;

/** Barcelona's calendar date, weekday (Monday = 0) and minutes into the day for an instant. */
function madridParts(at: Date): { date: string; weekday: number; minutes: number } {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(at);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")),
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The weekend an instant falls in, named by its Friday (YYYY-MM-DD), or null for
 * any other moment.
 *
 *   Friday from 12:00, all of Saturday and Sunday, Monday until 12:00.
 *
 * Judged on Barcelona's clock, so it is right across the March and October clock
 * changes: those happen on a Sunday, inside the weekend, and move nothing.
 */
export function weekendOf(at: Date | string | number): string | null {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  const { date, weekday, minutes } = madridParts(d);
  if (weekday === 4 && minutes >= WEEKEND_START_HOUR * 60) return date;            // Friday afternoon
  if (weekday === 5) return addDays(date, -1);                                      // Saturday
  if (weekday === 6) return addDays(date, -2);                                      // Sunday
  if (weekday === 0 && minutes < WEEKEND_END_HOUR * 60) return addDays(date, -3);   // Monday morning
  return null;
}

/** 32-bit FNV-1a, then a final mix so nearby dates do not give nearby results. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** The whole percentage added on the weekend that begins on this Friday: 15 to 22 inclusive. */
export function weekendPercent(friday: string): number {
  const span = WEEKEND_MAX_PERCENT - WEEKEND_MIN_PERCENT + 1;
  return WEEKEND_MIN_PERCENT + (hash(`${WEEKEND_SALT}:${friday}`) % span);
}

export interface WeekendPrice {
  /** What the customer pays: whole euros. */
  price: number;
  /** True when the pickup is inside a weekend. */
  weekend: boolean;
  /** The percentage added. For the office and the audit trail, never for a customer. */
  percent: number;
}

/**
 * A fare for this pickup moment: the fare itself on a weekday, the fare plus the
 * weekend's percentage inside a weekend.
 *
 * Rounded to a whole euro. Every fare in the table is one, and a price of
 * €58.50 or €57.97 reads as a calculation, which is the thing being kept from
 * the customer.
 */
export function withWeekend(fare: number, pickup: Date | string | number): WeekendPrice {
  const friday = weekendOf(pickup);
  if (!friday || !(fare > 0)) return { price: fare, weekend: false, percent: 0 };
  const percent = weekendPercent(friday);
  return { price: Math.round(fare * (1 + percent / 100)), weekend: true, percent };
}

/** The upcoming weekends and their percentages, for the office's own view. */
export function upcomingWeekends(from: Date = new Date(), count = 8): { friday: string; monday: string; percent: number; current: boolean }[] {
  const now = madridParts(from);
  // The Friday of this weekend if one is under way, otherwise the next Friday.
  const current = weekendOf(from);
  // Friday before noon is still ahead of its own weekend: it starts today.
  const untilFriday = now.weekday === 4 ? 0 : (4 - now.weekday + 7) % 7;
  let friday = current ?? addDays(now.date, untilFriday);
  const out: { friday: string; monday: string; percent: number; current: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ friday, monday: addDays(friday, 3), percent: weekendPercent(friday), current: i === 0 && current !== null });
    friday = addDays(friday, 7);
  }
  return out;
}
