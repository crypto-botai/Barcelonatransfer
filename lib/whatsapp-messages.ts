import { formatPickupDateTime } from "@/lib/datetime";
import { formatExtras, formatExtraNames, forChauffeur, parseBookingMeta } from "@/lib/booking-meta";
import { paymentTag } from "@/lib/whatsapp-tags";

/**
 * The words that go into each WhatsApp template, worked out from a booking.
 *
 * One function per message, each returning the template's fields by name. The
 * names are the ones lib/whatsapp-template-defs.ts lists, in the order Meta
 * numbers its slots, so a field cannot silently land in the wrong slot.
 *
 * Who sees what is decided here and nowhere else:
 *   - the customer (and the office) see the real price and what was paid
 *   - a chauffeur sees the extras by name, never their price, and the one
 *     figure the office or their fleet company set for them, never the fare
 *
 * Pure: no database, no network. The caller supplies the facts.
 */

export interface MessageBooking {
  confirmationCode: string;
  status: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  pickupAddress: string;
  dropoffAddress: string | null;
  pickupDatetime: Date | string;
  passengers: number;
  luggage: number;
  vehicleClass: string;
  flightNumber: string | null;
  specialRequests: string | null;
  totalAmount: number;
  paymentStatus: string;
  paymentMethod: string | null;
  depositAmount: number | null;
  balanceAmount: number | null;
  balancePaidAt: Date | string | null;
  /** What the driver was told they would earn: the office's figure, or the fleet company's. */
  driverAmount: number | null;
}

export interface MessageDriver {
  name: string | null;
  phone: string | null;
  vehicle?: { make: string; model: string; licensePlate: string } | null;
}

export type Fields = Record<string, string>;

const NONE = "-";

export const euro = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2)}`;

const title = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const when = (d: Date | string) => formatPickupDateTime(new Date(d));

/** Child seats the customer ordered. There is no children column, the seats say it. */
const CHILD_SEATS = ["baby_seat", "child_seat", "booster_seat"];

function childrenLine(specialRequests: string | null): string {
  const seats = parseBookingMeta(specialRequests).extras.filter((e) => CHILD_SEATS.includes(e.id));
  const n = seats.reduce((t, e) => t + e.quantity, 0);
  if (n === 0) return "None";
  return `${n} (${seats.map((e) => (e.quantity > 1 ? `${e.label} x${e.quantity}` : e.label)).join(", ")})`;
}

/** What the customer wrote in their own words, without the structured block. */
const requestsLine = (specialRequests: string | null) => (parseBookingMeta(specialRequests).notes ?? "").trim() || "None";

const airportMeeting = (b: MessageBooking) =>
  /airport|terminal|aeropuerto/i.test(b.pickupAddress) && b.flightNumber ? `${b.pickupAddress} (arrivals, flight ${b.flightNumber})` : b.pickupAddress;

/** Where the customer's money stands, in a sentence a person can act on. */
export function paymentLine(b: MessageBooking): string {
  const t = paymentTag({ ...b, id: "", pickupDatetime: b.pickupDatetime });
  return t.tag === "deposit" ? (t.detail ?? t.label) : t.label;
}

/** The part both the customer's confirmation and the office's request share. */
function details(b: MessageBooking, extras: string): Fields {
  return {
    when: when(b.pickupDatetime),
    name: b.guestName?.trim() || NONE,
    phone: b.guestPhone?.trim() || NONE,
    email: b.guestEmail?.trim() || NONE,
    pickup: b.pickupAddress,
    dropoff: b.dropoffAddress?.trim() || "As arranged",
    flight: b.flightNumber?.trim() || "None",
    passengers: String(b.passengers),
    luggage: String(b.luggage),
    children: childrenLine(b.specialRequests),
    vehicleType: title(b.vehicleClass),
    extras: extras || "None",
    requests: requestsLine(b.specialRequests),
  };
}

/**
 * The confirmation, for the customer and for the office: the whole booking, the
 * price and where the payment stands.
 *
 * There is no driver in it. A booking comes in from the customer and nobody is
 * assigned until the office does it, so a driver line would only ever say "to be
 * assigned". The chauffeur is told in his own message (driverAssignedFields).
 */
export function confirmationFields(b: MessageBooking): Fields {
  return {
    ...details(b, formatExtras(parseBookingMeta(b.specialRequests).extras)),
    ref: b.confirmationCode,
    pickupPoint: airportMeeting(b),
    pickupTime: when(b.pickupDatetime),
    price: euro(b.totalAmount),
    payment: paymentLine(b),
  };
}

/** A new enquiry for the office: what a lead has told us so far. Anything not given says so. */
export function requestFields(l: {
  name?: string | null; email?: string | null; phone?: string | null; pickup?: string | null; dropoff?: string | null;
  when?: string | null; passengers?: number | null; flight?: string | null; luggage?: number | null;
}): Fields {
  const given = (v: string | null | undefined) => v?.trim() || "Not given yet";
  return {
    when: given(l.when),
    name: given(l.name),
    phone: given(l.phone),
    email: given(l.email),
    pickup: given(l.pickup),
    dropoff: given(l.dropoff),
    flight: given(l.flight),
    passengers: l.passengers ? String(l.passengers) : "Not given yet",
    luggage: l.luggage != null ? String(l.luggage) : "Not given yet",
    children: "Not given yet",
    vehicleType: "Not chosen yet",
    extras: "None yet",
    requests: "None yet",
  };
}

/** The chauffeur's name, number and car, for the customer. */
export function driverAssignedFields(b: MessageBooking, driver: MessageDriver): Fields {
  const v = driver.vehicle;
  return {
    ref: b.confirmationCode,
    driver: driver.name?.trim() || "Your chauffeur",
    driverContact: driver.phone?.trim() || NONE,
    vehicle: v ? `${v.make} ${v.model}`.trim() : "Your vehicle",
    plate: v?.licensePlate || NONE,
    pickupTime: when(b.pickupDatetime),
    pickup: b.pickupAddress,
  };
}

/**
 * What the chauffeur is told about the cash on the day: an instruction, not a
 * price list. It says whether to take money and how much, which is the one
 * thing a driver must know, and nothing about the rest of the fare.
 */
function collectLine(b: MessageBooking): string {
  if (b.paymentStatus === "PAID") {
    const balance = b.balanceAmount ?? 0;
    return balance > 0 && !b.balancePaidAt ? `Collect ${euro(balance)} from the passenger` : "Paid online, nothing to collect";
  }
  return `Collect ${euro(b.totalAmount)} from the passenger`;
}

/**
 * The job, for the chauffeur. Extras by name only, one fare (the figure set for
 * them) and the cash to take. The customer's price, the price of any extra, a
 * tip and a membership tier are not in it and cannot be: they are not read here.
 */
export function driverJobFields(b: MessageBooking): Fields {
  const meta = parseBookingMeta(b.specialRequests);
  return {
    ref: b.confirmationCode,
    pickupTime: when(b.pickupDatetime),
    passenger: b.guestName?.trim() || NONE,
    passengerPhone: b.guestPhone?.trim() || NONE,
    pickup: b.pickupAddress,
    dropoff: b.dropoffAddress?.trim() || "As arranged",
    flight: b.flightNumber?.trim() || "None",
    passengers: String(b.passengers),
    luggage: String(b.luggage),
    children: childrenLine(b.specialRequests),
    vehicleType: title(b.vehicleClass),
    extras: forChauffeur(meta.extras).length ? formatExtraNames(meta.extras) : "None",
    requests: requestsLine(b.specialRequests),
    fare: b.driverAmount != null ? euro(b.driverAmount) : "As agreed with dispatch",
    collect: collectLine(b),
  };
}

export function completedFields(b: MessageBooking, reviewUrl: string): Fields {
  return {
    ref: b.confirmationCode,
    pickup: b.pickupAddress,
    dropoff: b.dropoffAddress?.trim() || "As arranged",
    name: b.guestName?.trim().split(" ")[0] || "there",
    link: reviewUrl,
  };
}

export function cancelledFields(b: MessageBooking): Fields {
  return {
    ref: b.confirmationCode,
    when: when(b.pickupDatetime),
    pickup: b.pickupAddress,
    dropoff: b.dropoffAddress?.trim() || "As arranged",
    name: b.guestName?.trim().split(" ")[0] || "there",
  };
}

export function driverCancelledFields(b: MessageBooking): Fields {
  return {
    ref: b.confirmationCode,
    when: when(b.pickupDatetime),
    passenger: b.guestName?.trim() || NONE,
    pickup: b.pickupAddress,
  };
}
