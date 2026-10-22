import { prisma } from "@/lib/prisma";
import { parseBookingMeta } from "@/lib/booking-meta";
import { notFound } from "./errors";
import { publicVehicle, VEHICLE_SELECT } from "./vehicle";
import { eventTime, isAirportPickup, waitingState } from "./waiting";

/**
 * What a customer app may know about one of their own rides.
 *
 * Built field by field. Nothing is spread from the database row, so a column
 * added to bookings later never reaches a phone by accident. The customer sees
 * their own price and, once a driver is assigned, who is coming; never the
 * driver's payout, the office notes or another person's details.
 */

export const CUSTOMER_RIDE_SELECT = {
  id: true, confirmationCode: true, status: true, rideStage: true, rideStageAt: true,
  pickupAddress: true, pickupLat: true, pickupLng: true,
  dropoffAddress: true, dropoffLat: true, dropoffLng: true,
  pickupDatetime: true, vehicleClass: true, passengers: true, luggage: true, flightNumber: true,
  specialRequests: true, totalAmount: true, paymentStatus: true,
  balanceAmount: true, balancePaidAt: true, protectionFee: true,
  durationMin: true, baseFare: true, rating: true, review: true, createdAt: true,
  returnOfId: true,
  driver: {
    select: {
      rating: true,
      user: { select: { name: true, phone: true } },
      vehicles: { where: { isActive: true }, take: 1, orderBy: { updatedAt: "desc" as const }, select: VEHICLE_SELECT },
    },
  },
  rideEvents: { orderBy: { createdAt: "asc" as const }, select: { stage: true, createdAt: true } },
} as const;

type Row = NonNullable<Awaited<ReturnType<typeof loadOwnedRide>>>;

export async function loadOwnedRide(id: string, userId: string) {
  const row = await prisma.booking.findFirst({
    where: { id, userId, isDeleted: false },
    select: CUSTOMER_RIDE_SELECT,
  });
  return row;
}

/** A ride the caller does not own is NOT_FOUND, not FORBIDDEN: the answer must not confirm that someone else's booking exists. */
export async function requireOwnedRide(id: string, userId: string): Promise<Row> {
  const row = await loadOwnedRide(id, userId);
  if (!row) throw notFound("We could not find that ride.");
  return row;
}

const DRIVER_VISIBLE = new Set(["DRIVER_ASSIGNED", "IN_PROGRESS", "COMPLETED"]);
const CANCELLABLE = new Set(["PENDING", "CONFIRMED", "DRIVER_ASSIGNED"]);

export interface RideExtras {
  /** When the passenger said they had landed (airport pickups). */
  landedAt?: Date | null;
  /** The chauffeur's profile picture and car photos: sent for one ride only, never in lists (they can be large). */
  driverImage?: string | null;
  carPhotos?: { front: string | null; back: string | null };
}

export function customerRideDto(b: Row, now = new Date(), extra: RideExtras = {}) {
  const meta = parseBookingMeta(b.specialRequests);
  const hired = meta.bookingType === "HOURLY" || meta.bookingType === "DAY_HIRE";
  const hours = hired && b.durationMin > 0 ? Math.round((b.durationMin / 60) * 100) / 100 : null;
  const drop = b.dropoffAddress.trim();

  return {
    id: b.id,
    code: b.confirmationCode,
    status: b.status,
    stage: b.rideStage,
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
    extras: meta.extras.map((e) => ({ label: e.label, quantity: e.quantity, price: e.price })),
    price: {
      total: b.totalAmount,
      currency: "EUR",
      paymentStatus: b.paymentStatus,
      balanceDue: b.balanceAmount && b.balanceAmount > 0 && !b.balancePaidAt ? b.balanceAmount : 0,
      protectionFee: b.protectionFee ?? 0,
    },
    driver:
      b.driver && DRIVER_VISIBLE.has(b.status)
        ? {
            name: b.driver.user.name,
            phone: b.driver.user.phone,
            rating: b.driver.rating > 0 ? b.driver.rating : null,
            image: extra.driverImage ?? null,
            vehicle: (() => {
              const v = publicVehicle(b.driver.vehicles[0]);
              return v ? { ...v, photos: extra.carPhotos ?? null } : null;
            })(),
          }
        : null,
    waiting: waitingState({
      airport: isAirportPickup(b),
      arrivedAt: eventTime(b.rideEvents, "ARRIVED"),
      onBoardAt: eventTime(b.rideEvents, "ON_BOARD"),
      landedAt: extra.landedAt ?? null,
      pickupAt: b.pickupDatetime,
      now,
      vehicleClass: b.vehicleClass,
    }),
    timeline: b.rideEvents.map((e) => ({ stage: e.stage, at: e.createdAt.toISOString() })),
    canCancel: CANCELLABLE.has(b.status) && b.pickupDatetime.getTime() > now.getTime(),
    canPay: b.paymentStatus !== "PAID" && CANCELLABLE.has(b.status),
    canRate: b.status === "COMPLETED" && b.rating === null,
    rating: b.rating,
    createdAt: b.createdAt.toISOString(),
  };
}
