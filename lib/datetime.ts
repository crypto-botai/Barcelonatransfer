/**
 * One conversion, at one boundary, for pickup times.
 *
 * The customer picks a wall-clock time on a Barcelona website and means
 * Barcelona time. That intention is the business truth; everything else is a
 * representation of it.
 *
 * What went wrong before: the booking API built `new Date("2026-09-15T10:30")`.
 * A datetime string carrying no zone is parsed as the *runtime's* local time,
 * and the runtime is UTC on Vercel — so a 10:30 pickup was stored as 10:30Z,
 * which is 12:30 in Barcelona. The confirmation email then printed the instant
 * with no timeZone option, so it also read "10:30" on a UTC server and looked
 * correct, while the admin dashboard and driver app formatted the same instant
 * in Europe/Madrid and showed 12:30. Two surfaces, two times, one booking. The
 * gap tracked the season, an hour in winter and two in summer, which is what
 * made it look intermittent.
 *
 * The rule now:
 *
 *   1. The picker yields a date and a time with no zone. They mean Europe/Madrid.
 *   2. `pickupToUtc` converts that to an instant, exactly once, at the API edge.
 *   3. The database stores the instant.
 *   4. Every surface renders it back through `formatPickup*`, in Europe/Madrid.
 *
 * No fixed offset is written down anywhere. CET, CEST and the two transition
 * days come from the IANA database via Intl, so this stays correct without
 * anyone remembering to change it twice a year.
 */

export const BOOKING_TIMEZONE = "Europe/Madrid";

/**
 * How far `instant` is ahead of UTC in `timeZone`, in milliseconds.
 *
 * Read from Intl rather than assumed, so it is right on both sides of a DST
 * transition without a table of offsets.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Some engines render midnight as hour 24; normalise before arithmetic.
  const wallClockAsUtc = Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour") % 24, get("minute"), get("second"),
  );
  return wallClockAsUtc - instant.getTime();
}

/**
 * Turns a wall-clock date and time in Barcelona into the instant it refers to.
 *
 * @param date "YYYY-MM-DD" from a date input
 * @param time "HH:MM" (or "HH:MM:SS") from a time input
 * @returns the corresponding UTC instant, or null if either field is malformed
 *
 * Two passes: guess the offset from the naive reading, then re-read it at the
 * corrected instant. The second pass matters only near a transition, where the
 * first guess can land on the wrong side of the change.
 *
 * On the spring-forward morning the hour 02:00–03:00 does not exist in Madrid.
 * A pickup entered inside it resolves to the same instant as 03:00 local, which
 * is the only real time it can mean. On the autumn morning 02:00–03:00 happens
 * twice; the earlier, summer-time occurrence is chosen. Both are deterministic,
 * and both are one hour from any other reading — a difference the driver notices
 * long before the customer is left standing outside.
 */
export function pickupToUtc(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!d || !t) return null;

  const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hour, minute, second] = [Number(t[1]), Number(t[2]), Number(t[3] ?? 0)];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstGuess = zoneOffsetMs(new Date(naive), BOOKING_TIMEZONE);
  let instant = naive - firstGuess;

  const corrected = zoneOffsetMs(new Date(instant), BOOKING_TIMEZONE);
  if (corrected !== firstGuess) instant = naive - corrected;

  const result = new Date(instant);
  return Number.isNaN(result.getTime()) ? null : result;
}

/**
 * Same conversion for callers holding one combined string.
 *
 * A string that names its offset ("...Z", "+02:00") already identifies an
 * instant and is taken at its word. One that does not is a wall clock, and a
 * wall clock on this system means Barcelona — never the server's zone, which is
 * what the bare Date constructor would assume.
 */
export function parsePickupInput(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;

  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?)/.exec(raw);
  return m ? pickupToUtc(m[1], m[2]) : null;
}

/**
 * Splits an instant back into the wall-clock fields Barcelona would show.
 * Useful for pre-filling an edit form, where a picker needs the parts.
 */
export function pickupToParts(instant: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOOKING_TIMEZONE,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = String(Number(get("hour")) % 24).padStart(2, "0");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

const DATE_TIME: Intl.DateTimeFormatOptions = {
  timeZone: BOOKING_TIMEZONE,
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false,
};

/**
 * "15/09/2026, 10:30" — the pickup as Barcelona reads it.
 *
 * Always pass an instant through here rather than toLocaleString(): the bare
 * call formats in whatever zone the code happens to be running in, which is
 * how the email and the dashboard came to disagree.
 */
export function formatPickupDateTime(instant: Date | string): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", DATE_TIME).format(d);
}

/** "10:30" in Barcelona. */
export function formatPickupTime(instant: Date | string): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BOOKING_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

/** "15/09/2026" in Barcelona. */
export function formatPickupDate(instant: Date | string): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BOOKING_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric",
  }).format(d);
}
