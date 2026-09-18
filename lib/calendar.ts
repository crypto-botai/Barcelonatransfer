/**
 * "Add to calendar" for a booking: a Google Calendar link and an .ics file.
 *
 * The .ics is served by /api/bookings/:id/calendar?code=… and proved by the
 * confirmation code, the same way the tracking page is, so it can sit in an
 * email without a session. Apple Calendar and Outlook open .ics natively.
 */

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export interface CalendarBooking {
  id: string;
  confirmationCode: string;
  pickupAddress: string;
  dropoffAddress?: string | null;
  pickupDatetime: Date;
  durationMin?: number | null;
}

export function calendarLinks(b: CalendarBooking): { google: string; ics: string } {
  const start = b.pickupDatetime;
  const end = new Date(start.getTime() + Math.max(30, b.durationMin ?? 60) * 60_000);
  const title = `Elite BCN transfer · ${b.pickupAddress.split(",")[0]}${b.dropoffAddress ? ` → ${b.dropoffAddress.split(",")[0]}` : ""}`;
  const details = `Booking ${b.confirmationCode}. Track your chauffeur: ${SITE_URL}/track/${b.confirmationCode}`;
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${icsStamp(start)}/${icsStamp(end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(b.pickupAddress)}`;
  const ics = `${SITE_URL}/api/bookings/${b.id}/calendar?code=${encodeURIComponent(b.confirmationCode)}`;
  return { google, ics };
}

export function icsFile(b: CalendarBooking): string {
  const start = b.pickupDatetime;
  const end = new Date(start.getTime() + Math.max(30, b.durationMin ?? 60) * 60_000);
  const title = `Elite BCN transfer${b.dropoffAddress ? ` to ${b.dropoffAddress.split(",")[0]}` : ""}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elite BCN Transfers//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${b.id}@elitebcn.info`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    `LOCATION:${icsEscape(b.pickupAddress)}`,
    `DESCRIPTION:${icsEscape(`Booking ${b.confirmationCode}. Your chauffeur's details and live position: ${SITE_URL}/track/${b.confirmationCode}`)}`,
    `URL:${SITE_URL}/track/${b.confirmationCode}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Elite BCN transfer in 2 hours",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** The reverse of a journey, pre-filled on the booking form. */
export function returnTripUrl(b: { pickupAddress: string; dropoffAddress?: string | null; pickupLat?: number | null; pickupLng?: number | null; dropoffLat?: number | null; dropoffLng?: number | null; passengers?: number | null; vehicleClass?: string | null }): string | null {
  if (!b.dropoffAddress) return null;
  const p = new URLSearchParams({ pickupAddress: b.dropoffAddress, dropoffAddress: b.pickupAddress });
  if (b.dropoffLat && b.dropoffLng) { p.set("pickupLat", String(b.dropoffLat)); p.set("pickupLng", String(b.dropoffLng)); }
  if (b.pickupLat && b.pickupLng) { p.set("dropoffLat", String(b.pickupLat)); p.set("dropoffLng", String(b.pickupLng)); }
  if (b.passengers) p.set("passengers", String(b.passengers));
  if (b.vehicleClass) p.set("vehicleClass", b.vehicleClass);
  return `${SITE_URL}/book?${p.toString()}`;
}
