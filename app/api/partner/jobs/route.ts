import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/partner";
import { parseBookingMeta, formatExtraNames } from "@/lib/booking-meta";
import { collectDue } from "@/lib/checkout-money";

/**
 * The company's jobs. Everything the office has sent it, newest pick-up
 * first, with the driver it put on each.
 *
 * The customer's fare is not in the response. The company sees its payout, what
 * it chose to show its driver, and what the driver must collect on the day.
 * Extras are returned by name only: what the customer paid for them, any tip,
 * and their membership tier are between the customer and the office, and the
 * browser can read whatever this route sends. So they are removed here, not
 * merely hidden by the page.
 */
export async function GET(req: NextRequest) {
  const p = await requirePartner({ allowInactive: true });
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = req.nextUrl.searchParams.get("scope") ?? "all";

  /**
   * "Needs a driver" is about the driver, not only about the status.
   *
   * A job can read DRIVER_ASSIGNED with nobody on it, because deleting a
   * driver used to clear the booking's driverId and leave the status alone.
   * Such a job showed as "Dispatched", sat under Active, and the Dispatch
   * button exists only on Incoming - so it could never be handed to anyone.
   * Asking for a missing driver instead of a particular status puts it back
   * where it can be dealt with, and repairs the ones already in that state.
   */
  const NEEDS_DRIVER = { OR: [{ status: "CONFIRMED" as const }, { status: "DRIVER_ASSIGNED" as const, driverId: null }] };
  const HAS_DRIVER   = { status: { in: ["DRIVER_ASSIGNED" as const, "IN_PROGRESS" as const] }, driverId: { not: null } };

  const scoped =
    scope === "incoming"  ? NEEDS_DRIVER :
    scope === "active"    ? HAS_DRIVER :
    scope === "completed" ? { status: "COMPLETED" as const } :
    scope === "cancelled" ? { status: { in: ["CANCELLED" as const, "REFUNDED" as const] } } :
    {};

  const jobs = await prisma.booking.findMany({
    where: { partnerId: p.id, isDeleted: false, ...scoped },
    orderBy: { pickupDatetime: scope === "completed" || scope === "cancelled" ? "desc" : "asc" },
    take: 300,
    select: {
      id: true, confirmationCode: true, status: true,
      // The company is driving this person. It needs to be able to reach them
      // without ringing the office, which means the address as well as the
      // phone: a flight that lands at 01:30 is not a moment to be calling.
      guestName: true, guestPhone: true, guestEmail: true,
      pickupAddress: true, dropoffAddress: true, pickupDatetime: true,
      pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true,
      passengers: true, luggage: true, vehicleClass: true, flightNumber: true, specialRequests: true,
      partnerPayout: true, driverAmount: true, partnerAssignedAt: true, partnerDispatchedAt: true,
      // What the driver collects from the client, if anything.
      totalAmount: true, paymentStatus: true, paymentMethod: true, balanceAmount: true, balancePaidAt: true,
      rideStage: true, rideEndedAt: true,
      driverId: true,
      noShow: { select: { images: true, note: true, waitedMin: true, createdAt: true, lat: true, lng: true } },
      driver: { select: { id: true, user: { select: { name: true, phone: true } }, vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } } } },
    },
  });
  /**
   * How many jobs sit behind each tab.
   *
   * Without these an empty tab is indistinguishable from an empty portal. A
   * company whose only job was already dispatched opened Incoming, read "no
   * job is waiting", and concluded the panel could not do any of this - the
   * job, the driver on it and the dispatch button were all one tab away.
   */
  const base = { partnerId: p.id, isDeleted: false };
  const [incoming, active, completed, cancelled] = await Promise.all([
    prisma.booking.count({ where: { ...base, ...NEEDS_DRIVER } }),
    prisma.booking.count({ where: { ...base, ...HAS_DRIVER } }),
    prisma.booking.count({ where: { ...base, status: "COMPLETED" } }),
    prisma.booking.count({ where: { ...base, status: { in: ["CANCELLED", "REFUNDED"] } } }),
  ]);

  const safe = jobs.map(({ specialRequests, totalAmount, paymentStatus, paymentMethod, balanceAmount, balancePaidAt, ...rest }) => {
    const meta = parseBookingMeta(specialRequests);
    return {
      ...rest,
      // The customer's own words, the extras by name and the stops: what the
      // chauffeur has to act on, with no money in any of it.
      notes: meta.notes || null,
      extras: meta.extras.map((x) => ({ id: x.id, label: x.label, quantity: x.quantity })),
      extrasText: meta.extras.length ? formatExtraNames(meta.extras) : null,
      stops: meta.stops,
      durationHours: meta.durationHours ?? null,
      // What the driver takes from the client, worked out here from the figures
      // that stay behind. It is an instruction, not a price list.
      collect: collectDue({ totalAmount, paymentStatus, paymentMethod, balanceAmount, balancePaidAt }),
    };
  });

  return NextResponse.json({ jobs: safe, counts: { incoming, active, completed, cancelled } });
}
