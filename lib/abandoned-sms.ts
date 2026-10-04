import { COMPANY } from "@/lib/company-facts";

/**
 * The text the office sends to someone who nearly booked and may not use WhatsApp.
 *
 * It is about their own enquiry, nothing else: the journey they were booking and
 * where to reach a person. It asks for nothing and sells nothing, and it names no
 * price, because a figure quoted last week may no longer be the figure today.
 *
 * Written to fit two text segments (320 characters) even with long place names,
 * and in plain letters, because an accent or a dash can push a text into the
 * expensive encoding (see lib/sms.ts).
 */

export const SMS_MAX_CHARS = 320;

/** The first part of an address: "Barcelona Airport Terminal 1, El Prat" becomes "Barcelona Airport Terminal 1". */
const place = (v: string | null | undefined) => (v ?? "").split(",")[0].trim().slice(0, 42);

export interface SmsLead {
  name?: string | null;
  pickup?: string | null;
  dropoff?: string | null;
  /** Their travel date, as they typed it into the form (YYYY-MM-DD) or as already formatted. */
  date?: string | null;
  time?: string | null;
}

/** "2026-12-10" and "16:00" as "10 Dec at 16:00". Anything else is passed through as written. */
function when(date?: string | null, time?: string | null): string {
  const d = (date ?? "").trim();
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  const nice = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }) : d;
  return time?.trim() ? `${nice} at ${time.trim()}` : nice;
}

export function abandonedSmsText(l: SmsLead): string {
  const first = (l.name ?? "").trim().split(/\s+/)[0];
  const from = place(l.pickup);
  const to = place(l.dropoff);
  const at = when(l.date, l.time);

  const journey =
    from && to ? `your transfer from ${from} to ${to}${at ? ` on ${at}` : ""}` :
    from ? `your transfer from ${from}${at ? ` on ${at}` : ""}` :
    "your transfer enquiry";

  const text =
    `Hi${first ? ` ${first}` : ""}, Elite BCN Transfers here. About ${journey}: ` +
    `if you still need a ride, message us on WhatsApp ${COMPANY.phoneDisplay} or email ${COMPANY.email} and we will sort it for you.`;

  return text.slice(0, SMS_MAX_CHARS);
}
