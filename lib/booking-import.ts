/**
 * Turning a near-booking back into a booking the office can complete.
 *
 * Two kinds exist. A lead is a form session with contact details that never
 * reached the checkout, and has no booking row. An unpaid booking got as far
 * as the payment page and stopped, so a row already exists, with a
 * confirmation code the customer may have seen on screen and in the recovery
 * email.
 *
 * That difference decides what happens on save, and is why the two are kept
 * apart rather than merged: a lead becomes a new booking, an unpaid one is
 * completed in place. Creating a second row for an unpaid booking would
 * leave two bookings for one journey, the chase list would keep emailing the
 * dead one, and the reference the customer was given would belong to neither.
 *
 * Kept out of the panel component so the mapping can be tested on its own.
 * Both sources come from a database the office does not control the shape
 * of: a lead's form data is whatever the widget had when the visitor left,
 * so every field here has to survive being absent.
 */

import { parseBookingMeta } from "@/lib/booking-meta";
import { FLEET_TO_DB_CLASS, VEHICLE_CATALOG, type BookingExtra, type FleetVehicle } from "@/types";

export type Place = { address: string; lat: number; lng: number };

/** Where a prefilled form came from, carried through to the save. */
export type ImportSource =
  | { kind: "lead";   sessionId: string;  label: string }
  | { kind: "unpaid"; bookingId: string;  label: string };

export interface Prefill {
  name: string; email: string; phone: string;
  pickup: Place; dropoff: Place;
  date: string; time: string;
  pax: number; bags: number;
  vehicle: FleetVehicle;
  flight: string; notes: string;
  /** The price they were quoted, as a string for the form field. */
  price: string;
  /**
   * The leg home, when the cart had one.
   *
   * The booking widget asks for it, so a lead that wanted a return already
   * carries the dates. Dropping them here would have the office ring back to
   * ask for something the customer had already typed in.
   */
  returnDate?: string;
  returnTime?: string;
  source: ImportSource;
}

export type Lead = {
  sessionId: string; email: string | null; name: string | null; phone: string | null; step: number;
  formData: Record<string, unknown>; lastActivity: string; createdAt: string;
  abandonedBooking: { emailSentAt: string | null; convertedAt: string | null } | null;
};

export type Unpaid = {
  id: string; confirmationCode: string; guestName: string | null; guestEmail: string | null; guestPhone: string | null;
  pickupAddress: string; dropoffAddress: string; pickupDatetime: string; passengers: number; vehicleClass: string;
  totalAmount: number; createdAt: string; recoveryEmailedAt: string | null;
  pickupLat: number | null; pickupLng: number | null; dropoffLat: number | null; dropoffLng: number | null;
  luggage: number | null; flightNumber: string | null; specialRequests: string | null;
};


/**
 * The car the customer picked, from whichever field recorded it.
 *
 * A lead stores the exact vehicle; a booking stores only the class it belongs
 * to, and a class can hold two cars priced apart. Falling back to the first
 * car in the class is the closest the record allows, and the office can
 * change it before saving.
 */
export function fleetVehicleFrom(fleet?: string | null, dbClass?: string | null): FleetVehicle {
  if (fleet && VEHICLE_CATALOG.some((v) => v.class === fleet)) return fleet as FleetVehicle;
  const byClass = VEHICLE_CATALOG.find((v) => FLEET_TO_DB_CLASS[v.class] === dbClass);
  return byClass?.class ?? "EQE_300";
}

/** Extras cost money and are not fields on this form, so they go in the note. */
function notesWithExtras(notes: string, extras: BookingExtra[]): string {
  if (!extras.length) return notes;
  const line = `Extras chosen online: ${extras.map((e) => (e.quantity > 1 ? `${e.label} x${e.quantity}` : e.label)).join(", ")}`;
  return notes ? `${notes} — ${line}` : line;
}

function madridParts(iso: string) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}

export function prefillFromLead(l: Lead): Prefill {
  const fd = l.formData ?? {};
  const str = (k: string) => { const v = fd[k]; return v == null ? "" : String(v); };
  const num = (k: string, fallback: number) => { const n = Number(fd[k]); return Number.isFinite(n) && n > 0 ? n : fallback; };
  const quoted = (fd.quote as { totalAmount?: number } | undefined)?.totalAmount ?? Number(fd.totalAmount);
  const extras = Array.isArray(fd.extras) ? (fd.extras as BookingExtra[]) : [];
  return {
    name:  l.name  ?? str("guestName"),
    email: l.email ?? str("guestEmail"),
    phone: l.phone ?? str("guestPhone"),
    pickup:  { address: str("pickupAddress"),  lat: Number(fd.pickupLat)  || 0, lng: Number(fd.pickupLng)  || 0 },
    dropoff: { address: str("dropoffAddress"), lat: Number(fd.dropoffLat) || 0, lng: Number(fd.dropoffLng) || 0 },
    date: str("date"), time: str("time"),
    pax: num("passengers", 2), bags: num("luggage", 2),
    vehicle: fleetVehicleFrom(str("fleetVehicle"), str("vehicleClass")),
    flight: str("flightNumber"),
    notes: notesWithExtras(str("specialRequests"), extras),
    price: Number.isFinite(Number(quoted)) && Number(quoted) > 0 ? String(quoted) : "",
    // Both or neither: a date with no time cannot be dispatched, and offering
    // the office half a return is worse than offering none.
    returnDate: str("returnDate") && str("returnTime") ? str("returnDate") : undefined,
    returnTime: str("returnDate") && str("returnTime") ? str("returnTime") : undefined,
    source: { kind: "lead", sessionId: l.sessionId, label: l.name ?? l.email ?? l.sessionId },
  };
}

export function prefillFromUnpaid(b: Unpaid): Prefill {
  const { date, time } = madridParts(b.pickupDatetime);
  const meta = parseBookingMeta(b.specialRequests);
  return {
    name: b.guestName ?? "", email: b.guestEmail ?? "", phone: b.guestPhone ?? "",
    pickup:  { address: b.pickupAddress,  lat: b.pickupLat  ?? 0, lng: b.pickupLng  ?? 0 },
    dropoff: { address: b.dropoffAddress, lat: b.dropoffLat ?? 0, lng: b.dropoffLng ?? 0 },
    date, time,
    pax: b.passengers || 1, bags: b.luggage ?? 0,
    vehicle: fleetVehicleFrom(null, b.vehicleClass),
    flight: b.flightNumber ?? "",
    notes: notesWithExtras(meta.notes ?? "", meta.extras),
    price: String(b.totalAmount),
    source: { kind: "unpaid", bookingId: b.id, label: b.confirmationCode },
  };
}
