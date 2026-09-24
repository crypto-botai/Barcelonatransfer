import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { type VehicleClass } from "@/types";
import { sendBookingConfirmation, sendAdminNewBookingAlert } from "@/lib/resend";
import { withUniqueBookingCode } from "@/lib/booking-code";
import { parsePickupInput, formatPickupDateTime } from "@/lib/datetime";
import { createSumUpCheckout, getSumUpCheckoutUrl } from "@/lib/sumup";
import { PAYMENT_METHODS, paymentLine } from "@/lib/payment-method";
import { calendarLinks, returnTripUrl } from "@/lib/calendar";

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";

async function requireAdmin() {
  const s = await getServerSession(authOptions);
  if (!s) return null;
  const u = s.user as { role?: string; id?: string; name?: string };
  if (u.role !== "ADMIN") return null;
  return u;
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status    = req.nextUrl.searchParams.get("status");
  const search    = req.nextUrl.searchParams.get("q");
  const limit     = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "100"), 500);
  const deleted   = req.nextUrl.searchParams.get("deleted") === "true";
  // Website bookings that were never paid are not bookings yet; they live in
  // Abandoned, where the office chases them. Ones the office made by hand
  // (cash, transfer, WhatsApp) are confirmed and stay here.
  const includeUnpaid = req.nextUrl.searchParams.get("unpaid") === "true";

  const bookings = await prisma.booking.findMany({
    where: {
      isDeleted: deleted,
      ...(includeUnpaid || deleted ? {} : {
        NOT: { status: "PENDING", paymentStatus: "PENDING", paymentMethod: null },
      }),
      ...(status ? { status: status as never } : {}),
      ...(search ? {
        OR: [
          { confirmationCode: { contains: search, mode: "insensitive" } },
          { guestName:        { contains: search, mode: "insensitive" } },
          { guestEmail:       { contains: search, mode: "insensitive" } },
          { guestPhone:       { contains: search, mode: "insensitive" } },
          { pickupAddress:    { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      driver:  { include: { user: { select: { name: true, phone: true } }, vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } } } },
      user:    { select: { name: true, email: true } },
      partner: { select: { name: true } },
    },
  });

  return NextResponse.json(bookings);
}

const createSchema = z.object({
  guestName:       z.string().min(2),
  guestEmail:      z.string().email(),
  guestPhone:      z.string().min(6),
  pickupAddress:   z.string().min(3),
  pickupLat:       z.number().default(41.3851),
  pickupLng:       z.number().default(2.1734),
  dropoffAddress:  z.string().default(""),
  dropoffLat:      z.number().default(0),
  dropoffLng:      z.number().default(0),
  pickupDatetime:  z.string(),
  passengers:      z.number().int().min(1).default(1),
  luggage:         z.number().int().min(0).default(0),
  vehicleClass:    z.string().default("BUSINESS"),
  flightNumber:    z.string().optional(),
  specialRequests: z.string().optional(),
  totalAmount:     z.number().min(0),
  paymentStatus:   z.enum(["PENDING", "PAID", "FAILED"]).default("PENDING"),
  // How the customer pays. Cash, WhatsApp and transfer are marked received by
  // hand; a card link gets a checkout created here and a pay button in the
  // confirmation. Optional so older callers keep working.
  paymentMethod:   z.enum(PAYMENT_METHODS as [string, ...string[]]).optional(),
  driverAmount:    z.number().min(0).optional(),
  notes:           z.string().optional(),
  /** Off to record a booking silently, e.g. one already confirmed on WhatsApp. */
  sendEmail:       z.boolean().default(true),
  /**
   * An unpaid website booking this one is finishing off.
   *
   * The customer already has a row, with a confirmation code they may have
   * seen on screen and in the recovery email. Creating a second row would
   * leave two bookings for one journey, the chase list would keep emailing
   * the dead one, and the code the customer was quoted would belong to
   * neither. So the existing row is completed in place instead.
   */
  fromBookingId:   z.string().optional(),
  /**
   * The abandoned-cart session this was typed up from.
   *
   * Only used to close the lead once the booking exists, so the office does
   * not keep chasing someone who has already travelled.
   */
  fromSessionId:   z.string().optional(),
  /**
   * The journey home, on a round trip.
   *
   * A moment, not a second pair of addresses: the return leg is the outbound
   * one reversed, which is what the website has always meant by a return and
   * what stops the office entering the same two places twice. It becomes a
   * Booking of its own, linked back to the outbound, because two journeys on
   * two dates cannot share one row and still be assigned to two chauffeurs.
   */
  returnDatetime:  z.string().optional(),
  /** What the leg home costs. Defaults to the outbound fare, being the same journey. */
  returnAmount:    z.number().min(0).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body    = createSchema.parse(await req.json());
    // A wall-clock string from an admin form means Barcelona time, not the
    // server's zone. Offset-bearing input is respected as given.
    const pickup  = parsePickupInput(body.pickupDatetime);
    if (!pickup) {
      return NextResponse.json({ error: "Invalid date or time" }, { status: 422 });
    }

    const back = body.returnDatetime ? parsePickupInput(body.returnDatetime) : null;
    if (body.returnDatetime && !back) {
      return NextResponse.json({ error: "Invalid return date or time" }, { status: 422 });
    }
    // A chauffeur cannot drive them home before they have set off.
    if (back && back <= pickup) {
      return NextResponse.json({ error: "The return has to be after the outbound journey" }, { status: 422 });
    }
    // The same journey reversed costs the same unless the office says otherwise.
    const returnFare = back ? (body.returnAmount ?? body.totalAmount) : 0;

    // Everything below writes the same fields whether the row is new or an
    // unpaid one being finished off, so the two paths cannot drift apart.
    const fields = {
      guestName:       body.guestName,
      guestEmail:      body.guestEmail,
      guestPhone:      body.guestPhone,
      pickupAddress:   body.pickupAddress,
      pickupLat:       body.pickupLat,
      pickupLng:       body.pickupLng,
      dropoffAddress:  body.dropoffAddress,
      dropoffLat:      body.dropoffLat,
      dropoffLng:      body.dropoffLng,
      pickupDatetime:  pickup,
      passengers:      body.passengers,
      luggage:         body.luggage,
      vehicleClass:    body.vehicleClass as VehicleClass,
      flightNumber:    body.flightNumber,
      specialRequests: body.specialRequests,
      adminNotes:      body.notes,
      driverAmount:    body.driverAmount,
      baseFare:        body.totalAmount,
      totalAmount:     body.totalAmount,
      status:          "CONFIRMED" as const,
      paymentStatus:   body.paymentStatus,
      paymentMethod:   body.paymentMethod as never,
      paidAt:          body.paymentStatus === "PAID" ? new Date() : null,
      paidMarkedBy:    body.paymentStatus === "PAID" ? (admin.name ?? admin.id ?? "admin") : null,
    };

    let booking;
    if (body.fromBookingId) {
      // Finishing an unpaid website booking. It must still be unpaid: if the
      // customer paid the original link while the office was typing, or
      // another admin already converted it, writing over it would wipe the
      // payment and the confirmation code would go out twice.
      const existing = await prisma.booking.findUnique({ where: { id: body.fromBookingId } });
      if (!existing || existing.isDeleted) {
        return NextResponse.json({ error: "That unpaid booking no longer exists" }, { status: 404 });
      }
      if (existing.paymentStatus === "PAID" || existing.paymentMethod || existing.status !== "PENDING") {
        return NextResponse.json({ error: `${existing.confirmationCode} is no longer unpaid — open it from Bookings instead` }, { status: 409 });
      }
      booking = await prisma.booking.update({ where: { id: existing.id }, data: fields });
    } else {
      booking = await withUniqueBookingCode((confirmationCode) => prisma.booking.create({
        data: { confirmationCode, ...fields },
      }));
    }

    /**
     * The journey home, as a booking of its own.
     *
     * Its own row because it is its own job: a different day, a different
     * chauffeur, its own place on the dispatch board. Linked back through
     * returnOfId so the pair can be read as one trip where that matters.
     *
     * The flight number is deliberately dropped. It belongs to the arrival,
     * and a flight number on the ride home makes the tracker wait for a plane
     * that landed days ago.
     */
    let returnBooking: { id: string; confirmationCode: string } | null = null;
    if (back) {
      returnBooking = await withUniqueBookingCode((confirmationCode) => prisma.booking.create({
        data: {
          ...fields,
          confirmationCode,
          returnOfId:      booking.id,
          // The reverse journey: what was the drop-off is now the pickup.
          pickupAddress:   body.dropoffAddress || body.pickupAddress,
          pickupLat:       body.dropoffLat || body.pickupLat,
          pickupLng:       body.dropoffLng || body.pickupLng,
          dropoffAddress:  body.pickupAddress,
          dropoffLat:      body.pickupLat,
          dropoffLng:      body.pickupLng,
          pickupDatetime:  back,
          flightNumber:    null,
          specialRequests: `Return leg of booking ${booking.confirmationCode}.`,
          baseFare:        returnFare,
          totalAmount:     returnFare,
          // Whatever the office agreed for the outbound is a figure for that
          // leg; the way home takes the usual share unless it is set by hand.
          driverAmount:    null,
        },
      }));
    }

    // A lead that has become a booking is no longer a lead. Without this the
    // nightly sweep keeps emailing "you left something behind" to a customer
    // the office has already booked by hand.
    if (body.fromSessionId) {
      await prisma.bookingSession.updateMany({ where: { sessionId: body.fromSessionId }, data: { converted: true } }).catch(() => {});
      await prisma.abandonedBooking.updateMany({ where: { sessionId: body.fromSessionId }, data: { convertedAt: new Date() } }).catch(() => {});
    }

    // A card link needs a checkout to point at. Created here so the
    // confirmation can carry the button; the SumUp webhook and the daily
    // reconcile mark the booking paid when the customer uses it.
    // One link for the whole trip, attached to the outbound leg. Charging the
    // outbound alone would leave the way home unpaid with nothing saying so.
    const tripTotal = body.totalAmount + returnFare;
    let payUrl: string | undefined;
    if (body.paymentMethod === "CARD_LINK" && body.paymentStatus !== "PAID" && tripTotal > 0) {
      try {
        const checkout = await createSumUpCheckout({
          bookingId:     booking.id,
          amount:        tripTotal,
          description:   `Elite BCN: ${body.pickupAddress} -> ${body.dropoffAddress || "transfer"}${returnBooking ? " and back" : ""}`,
          customerEmail: body.guestEmail,
        });
        await prisma.booking.update({ where: { id: booking.id }, data: { stripeSessionId: checkout.id } });
        payUrl = `${SITE_URL}${getSumUpCheckoutUrl(checkout.id, booking.id)}`;
      } catch (e) {
        console.error("[admin create booking] checkout:", e);
      }
    }
    const payment = body.paymentMethod
      ? { line: paymentLine(body.paymentMethod as never, body.paymentStatus === "PAID", tripTotal), payUrl, paid: body.paymentStatus === "PAID" }
      : undefined;

    // Log activity
    await prisma.activityLog.create({
      data: {
        adminId:   admin.id,
        adminName: admin.name ?? "Admin",
        action:    body.fromBookingId ? "UPDATE" : "CREATE",
        entity:    "BOOKING",
        entityId:  booking.id,
        details:   {
          confirmationCode: booking.confirmationCode,
          amount: body.totalAmount,
          ...(body.fromBookingId ? { convertedFrom: "unpaid booking" } : {}),
          ...(body.fromSessionId ? { convertedFrom: "abandoned lead", sessionId: body.fromSessionId } : {}),
        } as never,
      },
    }).catch(() => {});

    // Notify customer
    if (body.sendEmail) sendBookingConfirmation({
      to:               body.guestEmail,
      name:             body.guestName,
      confirmationCode: booking.confirmationCode,
      pickupAddress:    body.pickupAddress,
      dropoffAddress:   body.dropoffAddress || "",
      pickupDatetime:   formatPickupDateTime(pickup),
      vehicleClass:     body.vehicleClass,
      totalAmount:      body.totalAmount,
      passengers:       body.passengers,
      bookingId:        booking.id,
      payment,
      calendar: calendarLinks({ id: booking.id, confirmationCode: booking.confirmationCode, pickupAddress: body.pickupAddress, dropoffAddress: body.dropoffAddress, pickupDatetime: pickup }),
      // Nothing to sell them a return with when they have already booked one.
      returnUrl: returnBooking ? null : returnTripUrl({ id: booking.id, pickupAddress: body.pickupAddress, dropoffAddress: body.dropoffAddress, pickupLat: body.pickupLat, pickupLng: body.pickupLng, dropoffLat: body.dropoffLat, dropoffLng: body.dropoffLng, passengers: body.passengers, vehicleClass: body.vehicleClass }),
      returnLeg: returnBooking && back ? {
        confirmationCode: returnBooking.confirmationCode,
        pickupDatetime:   formatPickupDateTime(back),
        // Reversed, which is what the customer is expecting to read.
        pickupAddress:    body.dropoffAddress || body.pickupAddress,
        dropoffAddress:   body.pickupAddress,
        totalAmount:      returnFare,
      } : undefined,
    }).catch(e => console.error("[resend] admin create booking confirmation:", e));

    // Notify admin panel (useful if another admin created it)
    sendAdminNewBookingAlert({
      confirmationCode: booking.confirmationCode,
      guestName:        body.guestName,
      guestEmail:       body.guestEmail,
      guestPhone:       body.guestPhone,
      pickupAddress:    body.pickupAddress,
      dropoffAddress:   body.dropoffAddress || "",
      pickupDatetime:   formatPickupDateTime(pickup),
      vehicleClass:     body.vehicleClass,
      totalAmount:      body.totalAmount,
      passengers:       body.passengers,
      luggage:          body.luggage,
      flightNumber:     body.flightNumber,
      specialRequests:  body.specialRequests,
    }).catch(() => {});

    return NextResponse.json({ ...booking, payUrl, returnConfirmationCode: returnBooking?.confirmationCode ?? null }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
