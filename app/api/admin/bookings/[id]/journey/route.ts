import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pickupToUtc, formatPickupDateTime } from "@/lib/datetime";
import { repriceForNewTime, applyToBalance } from "@/lib/reschedule-price";
import { endpointMoved, effectiveEndpoint, differenceFromQuote } from "@/lib/journey-edit";
import { getQuote } from "@/lib/pricing-service";
import { roadDistance } from "@/lib/geo";
import { sendBookingRescheduledEmail } from "@/lib/resend";
import { parseBookingMeta } from "@/lib/booking-meta";
import type { VehicleClass } from "@/types";

/**
 * Changing when a booking runs, where it starts, or where it ends.
 *
 * One route rather than two, because the fare depends on the whole journey
 * and pricing it in two passes would charge for the same change twice — and
 * would send the customer two emails for one phone call.
 *
 * The price is worked out and returned before anything is written. The office
 * sees what the change costs, decides, and sends it back with `confirm: true`.
 * Nothing is charged automatically: the difference lands on the balance the
 * chauffeur collects, which is where an office that has just agreed a change
 * on the phone would put it.
 *
 * Two pricing bases, chosen by what actually moved:
 *
 *   Time only  — the agreed fare carries over and only the time-dependent
 *                surcharge moves. The journey is the same journey, so
 *                re-quoting it would silently reprice a booking taken weeks
 *                ago at whatever the table says today. A fixed-price transfer
 *                never surcharges at all; "No surge pricing, ever" is on the
 *                public pricing page.
 *
 *   Address    — a different journey, so it is quoted afresh through the same
 *                getQuote the booking engine uses, against the same published
 *                price table. Today's price is the right price for a route
 *                nobody has agreed a fare for yet.
 *
 * Either way the office can waive the difference: a delayed flight or a hotel
 * that moved the guest is not the customer's doing.
 */

const endpoint = z.object({
  address: z.string().trim().min(3, "That address is too short.").max(300),
  // Bounded for the same reason the quote API bounds them: lat 999 / lng 999
  // was once accepted and priced as a 26,599 km journey.
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
}).refine((e) => e.lat !== 0 && e.lng !== 0, {
  // The address box reports 0,0 for text that has been typed but not chosen
  // from the list, and 0,0 is inside the bounds above — it is in the Gulf of
  // Guinea, some 4,700 km from Barcelona. lib/geo treats it as "not set" for
  // exactly this reason, and a fare must never be computed from it.
  message: "Choose the address from the list so it comes with a location.",
});

const schema = z.object({
  /** "YYYY-MM-DD" in Barcelona. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  /** "HH:mm" on a 24-hour clock, in Barcelona. */
  time: z.string().regex(/^\d{1,2}:\d{2}$/, "Time must be HH:mm"),
  /** Omitted when the office did not touch that end of the journey. */
  pickup:  endpoint.optional(),
  dropoff: endpoint.optional(),
  /**
   * False (the default) prices the change and writes nothing, so the office
   * can see the difference first. True applies it.
   */
  confirm: z.boolean().default(false),
  /** Whether to apply the price difference. The office may waive it. */
  applyPriceChange: z.boolean().default(true),
  /** Tell the customer. Default on. */
  notifyCustomer: z.boolean().default(true),
});

const CLOSED = ["CANCELLED", "REFUNDED", "COMPLETED"];

/** Same check the rest of the admin booking routes make. */
async function requireAdmin() {
  const s = await getServerSession(authOptions);
  if (!s) return null;
  const u = s.user as { role?: string; id?: string; name?: string };
  if (u.role !== "ADMIN") return null;
  return u;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const raw = await req.json().catch(() => null);
  if (raw === null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(raw);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.errors[0].message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const newPickupAt = pickupToUtc(body.date, body.time);
  if (!newPickupAt) {
    return NextResponse.json({ error: "That is not a real date and time." }, { status: 422 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true, confirmationCode: true, status: true,
      pickupDatetime: true,
      pickupAddress: true, pickupLat: true, pickupLng: true,
      dropoffAddress: true, dropoffLat: true, dropoffLng: true,
      vehicleClass: true, distanceKm: true, durationMin: true,
      baseFare: true, totalAmount: true, specialRequests: true,
      depositAmount: true, balanceAmount: true, balancePaidAt: true,
      guestName: true, guestEmail: true,
      user: { select: { name: true, email: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (CLOSED.includes(booking.status)) {
    return NextResponse.json(
      { error: `A ${booking.status.toLowerCase()} booking cannot be changed.` },
      { status: 409 },
    );
  }

  const currentPickup  = { address: booking.pickupAddress,  lat: booking.pickupLat,  lng: booking.pickupLng };
  const currentDropoff = { address: booking.dropoffAddress, lat: booking.dropoffLat, lng: booking.dropoffLng };

  const pickupChanged  = endpointMoved(currentPickup,  body.pickup);
  const dropoffChanged = endpointMoved(currentDropoff, body.dropoff);
  const routeChanged   = pickupChanged || dropoffChanged;

  const nextPickup  = effectiveEndpoint(currentPickup,  body.pickup);
  const nextDropoff = effectiveEndpoint(currentDropoff, body.dropoff);

  const timeChanged = newPickupAt.getTime() !== booking.pickupDatetime.getTime();
  if (!routeChanged && !timeChanged) {
    return NextResponse.json({ error: "Nothing has changed." }, { status: 422 });
  }

  const meta = parseBookingMeta(booking.specialRequests);

  // ── price the change ────────────────────────────────────────────────────
  let oldTotal: number;
  let newTotal: number;
  let difference: number;
  let basis: "time-only" | "requoted";
  let distanceKm = booking.distanceKm;
  let durationMin = booking.durationMin;
  let baseFare = booking.baseFare;
  let airportSurcharge: number | null = null;
  let nightSurcharge = 0;
  let lastMinuteSurcharge = 0;

  if (routeChanged) {
    basis = "requoted";

    const leg = await roadDistance(
      { lat: nextPickup.lat,  lng: nextPickup.lng },
      { lat: nextDropoff.lat, lng: nextDropoff.lng },
    );
    distanceKm  = leg.distanceKm;
    durationMin = leg.durationMin;

    const quote = await getQuote({
      pickupLat:  nextPickup.lat,
      pickupLng:  nextPickup.lng,
      dropoffLat: nextDropoff.lat,
      dropoffLng: nextDropoff.lng,
      // The exact car is not kept on the booking, so this prices by class,
      // exactly as the quote API does when the client omits it.
      vehicleClass: booking.vehicleClass as VehicleClass,
      pickupDatetime: newPickupAt,
      distanceKm,
      durationMin,
      pickupAddress:  nextPickup.address,
      dropoffAddress: nextDropoff.address,
    });

    // No price could be produced at all. Better to say so than to write a
    // fare nobody stands behind.
    if (quote.needsManualQuote) {
      return NextResponse.json(
        {
          error:
            "That route has no price in the table and could not be quoted automatically. " +
            "Change the addresses, or set the fare by hand on the booking.",
        },
        { status: 422 },
      );
    }

    baseFare            = quote.baseFare;
    airportSurcharge    = quote.airportSurcharge;
    nightSurcharge      = quote.nightSurcharge;
    lastMinuteSurcharge = quote.lastMinuteSurcharge;

    ({ oldTotal, newTotal, difference } = differenceFromQuote(booking.totalAmount, quote.totalAmount));
  } else {
    basis = "time-only";

    const priced = repriceForNewTime(
      {
        // A booking made before the fare was broken out can have a null base.
        baseFare: booking.baseFare ?? booking.totalAmount,
        totalAmount: booking.totalAmount,
        pickupDatetime: booking.pickupDatetime,
        bookingType: meta.bookingType,
      },
      newPickupAt,
    );
    oldTotal            = priced.oldTotal;
    newTotal            = priced.newTotal;
    difference          = priced.difference;
    nightSurcharge      = priced.newSurcharges.night;
    lastMinuteSurcharge = priced.newSurcharges.lastMinute;
  }

  const willApplyPrice = body.applyPriceChange && difference !== 0;
  const balance = willApplyPrice
    ? applyToBalance(booking, difference)
    : { balanceAmount: booking.balanceAmount, refundDue: 0 };

  const quoteOut = {
    bookingId: booking.id,
    confirmationCode: booking.confirmationCode,
    basis,
    timeChanged,
    pickupChanged,
    dropoffChanged,
    from: formatPickupDateTime(booking.pickupDatetime),
    to:   formatPickupDateTime(newPickupAt),
    oldPickupAddress:  booking.pickupAddress,
    newPickupAddress:  nextPickup.address,
    oldDropoffAddress: booking.dropoffAddress,
    newDropoffAddress: nextDropoff.address,
    oldDistanceKm: booking.distanceKm,
    newDistanceKm: distanceKm,
    oldTotal,
    newTotal:   willApplyPrice ? newTotal : oldTotal,
    difference: willApplyPrice ? difference : 0,
    nightSurcharge,
    lastMinuteSurcharge,
    balanceAmount: balance.balanceAmount,
    refundDue:     balance.refundDue,
  };

  // A dry run: show the office what the change costs, write nothing.
  if (!body.confirm) {
    return NextResponse.json({ ok: true, preview: true, ...quoteOut });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      pickupDatetime: newPickupAt,
      ...(routeChanged
        ? {
            pickupAddress:  nextPickup.address,
            pickupLat:      nextPickup.lat,
            pickupLng:      nextPickup.lng,
            dropoffAddress: nextDropoff.address,
            dropoffLat:     nextDropoff.lat,
            dropoffLng:     nextDropoff.lng,
            distanceKm,
            durationMin,
            // Only written when the fare is actually being applied; a waived
            // change must not leave the breakdown disagreeing with the total.
            ...(willApplyPrice
              ? {
                  baseFare,
                  ...(airportSurcharge != null ? { airportSurcharge } : {}),
                  nightSurcharge,
                }
              : {}),
          }
        : {}),
      ...(willApplyPrice ? { totalAmount: newTotal } : {}),
      // Only a booking that still has an uncollected balance moves it. One
      // already settled is left alone: the money is in, and rewriting the
      // figure would misreport what the chauffeur actually took.
      ...(willApplyPrice && booking.balanceAmount != null && booking.balancePaidAt == null
        ? { balanceAmount: balance.balanceAmount }
        : {}),
    },
    select: {
      id: true, pickupDatetime: true, totalAmount: true, balanceAmount: true,
      pickupAddress: true, dropoffAddress: true, distanceKm: true,
    },
  });

  const customerEmail = booking.guestEmail ?? booking.user?.email ?? null;
  if (body.notifyCustomer && customerEmail) {
    // Never let a mail problem undo a change the office has made.
    await sendBookingRescheduledEmail({
      to: customerEmail,
      name: booking.guestName ?? booking.user?.name ?? "Valued Client",
      confirmationCode: booking.confirmationCode,
      oldPickupDatetime: quoteOut.from,
      newPickupDatetime: quoteOut.to,
      pickupAddress: updated.pickupAddress,
      oldPickupAddress:  pickupChanged  ? booking.pickupAddress  : null,
      oldDropoffAddress: dropoffChanged ? booking.dropoffAddress : null,
      newDropoffAddress: updated.dropoffAddress,
      timeChanged,
      oldTotal: willApplyPrice ? oldTotal : null,
      newTotal: willApplyPrice ? newTotal : null,
      balanceDue: updated.balanceAmount,
    }).catch((err) => console.error("[journey] customer email failed", err));
  }

  return NextResponse.json({
    ok: true,
    preview: false,
    ...quoteOut,
    pickupDatetime: updated.pickupDatetime,
    totalAmount:    updated.totalAmount,
    notified:       body.notifyCustomer && !!customerEmail,
  });
}
