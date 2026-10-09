import { prisma } from "@/lib/prisma";
import { forChauffeur, parseBookingMeta } from "@/lib/booking-meta";
import { collectDue } from "@/lib/checkout-money";
import { BOOKING_TIMEZONE, pickupToUtc } from "@/lib/datetime";
import { nextStage, STAGE_META } from "@/lib/ride-stages";
import { forbidden, notFound, unauthenticated } from "./errors";

/**
 * What a driver app may know about a ride, and who the driver is.
 *
 * Built field by field, so a column added to bookings later never reaches a
 * phone by accident. A driver sees where to go, who to collect, what to bring,
 * what to collect in cash and their OWN payout. Never the customer's price, the
 * protection fee, the partner payout or the office notes.
 */

export const DRIVER_RIDE_SELECT = {
  id: true, confirmationCode: true, status: true, rideStage: true, rideStageAt: true,
  pickupAddress: true, pickupLat: true, pickupLng: true,
  dropoffAddress: true, dropoffLat: true, dropoffLng: true,
  pickupDatetime: true, vehicleClass: true, passengers: true, luggage: true, flightNumber: true,
  specialRequests: true, guestName: true, guestPhone: true,
  driverAmount: true, driverId: true, driverAssignedAt: true,
  driverResponse: true, driverRespondedAt: true, driverResponseBy: true,
  // Only to work out what the driver collects; never sent as such.
  totalAmount: true, paymentStatus: true, paymentMethod: true, balanceAmount: true, balancePaidAt: true,
  durationMin: true,
  customerLat: true, customerLng: true, customerLocatedAt: true,
} as const;

type Row = NonNullable<Awaited<ReturnType<typeof loadDriverRide>>>;

/** The driver record behind a signed-in DRIVER, or an error that ends the session. */
export async function requireDriver(userId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId }, select: { id: true, status: true, partnerId: true, rating: true, totalRides: true } });
  if (!driver) throw unauthenticated("Sign in again.");
  if (driver.status === "SUSPENDED" || driver.status === "PENDING_APPROVAL") throw forbidden("Your driver account is not active.");
  return driver;
}

export async function loadDriverRide(id: string, driverId: string) {
  return prisma.booking.findFirst({ where: { id, driverId, isDeleted: false }, select: DRIVER_RIDE_SELECT });
}

/** A ride that is not this driver's is NOT_FOUND: no confirmation that someone else's job exists. */
export async function requireDriverRide(id: string, driverId: string): Promise<Row> {
  const row = await loadDriverRide(id, driverId);
  if (!row) throw notFound("We could not find that ride.");
  return row;
}

export type DriverResponse = "PENDING" | "ACCEPTED" | "REJECTED";

/** The driver's answer counts only for the driver it was given by. */
export function effectiveResponse(b: { driverId: string | null; driverResponse: string | null; driverResponseBy: string | null }): DriverResponse {
  if (!b.driverId || b.driverResponseBy !== b.driverId) return "PENDING";
  return b.driverResponse === "ACCEPTED" ? "ACCEPTED" : b.driverResponse === "REJECTED" ? "REJECTED" : "PENDING";
}

export function driverRideDto(b: Row, now = new Date()) {
  const meta = parseBookingMeta(b.specialRequests);
  const hired = meta.bookingType === "HOURLY" || meta.bookingType === "DAY_HIRE";
  const hours = hired && b.durationMin > 0 ? Math.round((b.durationMin / 60) * 100) / 100 : null;
  const drop = b.dropoffAddress.trim();
  const response = effectiveResponse(b);
  const open = b.status === "DRIVER_ASSIGNED" || b.status === "IN_PROGRESS";
  const next = open && response !== "REJECTED" ? nextStage(b.rideStage) : null;
  const customerFresh = b.customerLocatedAt ? now.getTime() - b.customerLocatedAt.getTime() < 3 * 60_000 : false;

  return {
    id: b.id,
    code: b.confirmationCode,
    status: b.status,
    stage: b.rideStage,
    response,
    canRespond: b.status === "DRIVER_ASSIGNED" && response === "PENDING",
    // The next button the driver should see, from the same table the website's driver panel uses.
    next: next ? { stage: next, label: STAGE_META[next].action } : null,
    pickupAt: b.pickupDatetime.toISOString(),
    pickup: { address: b.pickupAddress, lat: b.pickupLat, lng: b.pickupLng },
    dropoff: drop ? { address: drop, lat: b.dropoffLat, lng: b.dropoffLng } : null,
    stops: meta.stops,
    bookingType: meta.bookingType ?? "TRANSFER",
    hire: hired && hours ? { kind: meta.bookingType === "DAY_HIRE" ? "FULL_DAY" : "HOURLY", hours } : null,
    vehicleClass: b.vehicleClass,
    passengers: b.passengers,
    luggage: b.luggage,
    flightNumber: b.flightNumber,
    notes: meta.notes,
    // What to bring, by name, with no prices.
    extras: forChauffeur(meta.extras).map((e) => ({ label: e.label, quantity: e.quantity })),
    customer: { name: b.guestName, phone: b.guestPhone },
    customerLocation: customerFresh && b.customerLat !== null && b.customerLng !== null ? { lat: b.customerLat, lng: b.customerLng, at: b.customerLocatedAt!.toISOString() } : null,
    payout: b.driverAmount,
    collect: collectDue({ totalAmount: b.totalAmount, paymentStatus: b.paymentStatus, paymentMethod: b.paymentMethod, balanceAmount: b.balanceAmount, balancePaidAt: b.balancePaidAt }),
  };
}

/* ───────────────────────────── Madrid days ───────────────────────────── */

const dateKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: BOOKING_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** [start, end) of the Madrid calendar day containing `at`. */
export function madridDay(at: Date): { start: Date; end: Date } {
  const start = pickupToUtc(dateKey(at), "00:00") ?? new Date(at.getTime() - (at.getTime() % 86_400_000));
  const next = pickupToUtc(dateKey(new Date(start.getTime() + 36 * 3600_000)), "00:00") ?? new Date(start.getTime() + 86_400_000);
  return { start, end: next };
}

/** Start of the Madrid week (Monday) and month containing `at`. */
export function madridPeriods(at: Date) {
  const day = madridDay(at);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: BOOKING_TIMEZONE, weekday: "short" }).format(at);
  const back = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  const weekStart = madridDay(new Date(day.start.getTime() - Math.max(0, back) * 86_400_000 + 3600_000)).start;
  const [y, m] = dateKey(at).split("-");
  const monthStart = pickupToUtc(`${y}-${m}-01`, "00:00") ?? day.start;
  return { today: day.start, week: weekStart, month: monthStart };
}
