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
import { seatShare, vehicleNote } from "@/lib/vehicle-group";

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
  /**
   * How many cars this journey needs.
   *
   * A group of twenty-four is one journey and four vans, and four vans is
   * four chauffeurs, four job sheets and four rows on the dispatch board.
   * There is no way to express that as one booking that anyone can drive, so
   * each vehicle becomes a booking of its own. totalAmount stays the price of
   * one car; the party is split across them.
   */
  vehicleCount:    z.number().int().min(1).max(10).default(1),
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
  /** Cars on the way back. Defaults to however many went out. */
  returnVehicleCount: z.number().int().min(1).max(10).optional(),
  /**
   * Where the leg home actually starts and ends, when it is not the reverse.
   *
   * The common case is the reverse and stays the default. But a guest who
   * arrives at one hotel and leaves from another is ordinary — they move
   * mid-stay, or fly out of Girona having flown into El Prat — and reversing
   * the outbound would send a chauffeur to the wrong door. Any of the four
   * may be given; each falls back to the reversed value.
   */
  returnPickupAddress:  z.string().optional(),
  returnPickupLat:      z.number().optional(),
  returnPickupLng:      z.number().optional(),
  returnDropoffAddress: z.string().optional(),
  returnDropoffLat:     z.number().optional(),
  returnDropoffLng:     z.number().optional(),
  /**
   * Further journeys for the same customer, each its own booking.
   *
   * A guest on a week's stay is one customer and several jobs: in from the
   * airport, across town mid-stay, out to the airport again. They were being
   * typed in as separate bookings with the contact details re-entered every
   * time, which is both slow and how a phone number ends up differing between
   * two rides of the same trip.
   */
  extraRides: z.array(z.object({
    pickupAddress:   z.string().min(3),
    pickupLat:       z.number().default(41.3851),
    pickupLng:       z.number().default(2.1734),
    dropoffAddress:  z.string().default(""),
    dropoffLat:      z.number().default(0),
    dropoffLng:      z.number().default(0),
    pickupDatetime:  z.string(),
    vehicleClass:    z.string().default("BUSINESS"),
    totalAmount:     z.number().min(0),
    passengers:      z.number().int().min(1).optional(),
    luggage:         z.number().int().min(0).optional(),
    flightNumber:    z.string().optional(),
    specialRequests: z.string().optional(),
    vehicleCount:    z.number().int().min(1).max(10).default(1),
  })).max(10).optional(),
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

    // Each extra ride's own moment, parsed before anything is written so a
    // typo in the third one does not leave the first two in the database.
    const extras = (body.extraRides ?? []).map((r) => ({ ...r, at: parsePickupInput(r.pickupDatetime) }));
    const badExtra = extras.findIndex((r) => !r.at);
    if (badExtra >= 0) {
      return NextResponse.json({ error: `Ride ${badExtra + 2} has an invalid date or time` }, { status: 422 });
    }

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
      // One car's share of the party. Whoever drives this one needs to know
      // how many are in it, not how many are on the trip.
      passengers:      seatShare(body.passengers, body.vehicleCount, 0),
      luggage:         seatShare(body.luggage, body.vehicleCount, 0),
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
     * Creates the second and further cars on one journey.
     *
     * The first one already exists and is the group's reference, which is why
     * its own note can only be written once it does. Each car is a full
     * booking so it can be assigned, driven and tracked on its own; what
     * differs between them is the share of the party and the note saying
     * which car of how many this is.
     */
    const siblings: { id: string; confirmationCode: string }[] = [];
    async function addVehicles(
      base: Record<string, unknown>,
      anchor: { id: string; confirmationCode: string },
      count: number,
      pax: number, bags: number, ownNote: string | undefined,
    ) {
      if (count <= 1) return;
      for (let i = 1; i < count; i++) {
        const made = await withUniqueBookingCode((confirmationCode) => prisma.booking.create({
          data: {
            ...base,
            confirmationCode,
            passengers:      seatShare(pax, count, i),
            luggage:         seatShare(bags, count, i),
            specialRequests: vehicleNote(ownNote, i, count, anchor.confirmationCode),
            // The agreed figure belongs to the car it was agreed for.
            driverAmount:    null,
          } as never,
        }));
        siblings.push(made);
      }
      // Now that the group has a reference, the first car can say so too.
      await prisma.booking.update({
        where: { id: anchor.id },
        data: { specialRequests: vehicleNote(ownNote, 0, count, anchor.confirmationCode) },
      });
    }

    await addVehicles(fields, booking, body.vehicleCount, body.passengers, body.luggage, body.specialRequests);

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
          // The reverse journey by default; either end can be somewhere else,
          // for a guest who changes hotel mid-stay or flies home from Girona.
          pickupAddress:   body.returnPickupAddress  || body.dropoffAddress || body.pickupAddress,
          pickupLat:       body.returnPickupLat  ?? (body.dropoffLat || body.pickupLat),
          pickupLng:       body.returnPickupLng  ?? (body.dropoffLng || body.pickupLng),
          dropoffAddress:  body.returnDropoffAddress || body.pickupAddress,
          dropoffLat:      body.returnDropoffLat ?? body.pickupLat,
          dropoffLng:      body.returnDropoffLng ?? body.pickupLng,
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

      // As many cars home as went out, unless the office said otherwise.
      const backCount = body.returnVehicleCount ?? body.vehicleCount;
      await addVehicles(
        {
          ...fields,
          returnOfId:      null,
          pickupAddress:   body.returnPickupAddress  || body.dropoffAddress || body.pickupAddress,
          pickupLat:       body.returnPickupLat  ?? (body.dropoffLat || body.pickupLat),
          pickupLng:       body.returnPickupLng  ?? (body.dropoffLng || body.pickupLng),
          dropoffAddress:  body.returnDropoffAddress || body.pickupAddress,
          dropoffLat:      body.returnDropoffLat ?? body.pickupLat,
          dropoffLng:      body.returnDropoffLng ?? body.pickupLng,
          pickupDatetime:  back,
          flightNumber:    null,
          baseFare:        returnFare,
          totalAmount:     returnFare,
        },
        returnBooking, backCount, body.passengers, body.luggage,
        `Return leg of booking ${booking.confirmationCode}.`,
      );
    }

    /**
     * The rest of this customer's journeys.
     *
     * Not linked to the outbound the way a return is: these are separate jobs
     * that happen to belong to the same guest, and tying them together would
     * say something about the trip that is not true. What they share is the
     * customer, the payment and the confirmation email telling them so.
     */
    const extraBookings: { id: string; confirmationCode: string; at: Date; ride: (typeof extras)[number] }[] = [];
    for (const ride of extras) {
      const made = await withUniqueBookingCode((confirmationCode) => prisma.booking.create({
        data: {
          ...fields,
          confirmationCode,
          pickupAddress:   ride.pickupAddress,
          pickupLat:       ride.pickupLat,
          pickupLng:       ride.pickupLng,
          dropoffAddress:  ride.dropoffAddress,
          dropoffLat:      ride.dropoffLat,
          dropoffLng:      ride.dropoffLng,
          pickupDatetime:  ride.at!,
          passengers:      seatShare(ride.passengers ?? body.passengers, ride.vehicleCount, 0),
          luggage:         seatShare(ride.luggage ?? body.luggage, ride.vehicleCount, 0),
          vehicleClass:    ride.vehicleClass as VehicleClass,
          flightNumber:    ride.flightNumber,
          specialRequests: ride.specialRequests,
          baseFare:        ride.totalAmount,
          totalAmount:     ride.totalAmount,
          // The figure the office agreed belongs to the ride it was agreed
          // for; the others take the usual share.
          driverAmount:    null,
        },
      }));
      extraBookings.push({ ...made, at: ride.at!, ride });

      await addVehicles(
        {
          ...fields,
          pickupAddress:  ride.pickupAddress,  pickupLat:  ride.pickupLat,  pickupLng:  ride.pickupLng,
          dropoffAddress: ride.dropoffAddress, dropoffLat: ride.dropoffLat, dropoffLng: ride.dropoffLng,
          pickupDatetime: ride.at!,
          vehicleClass:   ride.vehicleClass as VehicleClass,
          flightNumber:   ride.flightNumber,
          baseFare:       ride.totalAmount,
          totalAmount:    ride.totalAmount,
        },
        made, ride.vehicleCount,
        ride.passengers ?? body.passengers, ride.luggage ?? body.luggage,
        ride.specialRequests,
      );
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
    // One link for everything booked here, attached to the first ride.
    // Charging the first alone would leave the rest unpaid with nothing
    // anywhere saying so.
    // Every fare here is the price of one car, so each is multiplied by how
    // many of them are going. Charging one car for a party of four vans is
    // the kind of mistake nobody notices until the accounts are short.
    const tripTotal =
      body.totalAmount * body.vehicleCount
      + returnFare * (body.returnVehicleCount ?? body.vehicleCount)
      + extras.reduce((s, r) => s + r.totalAmount * r.vehicleCount, 0);
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
      // One email for the journey, not one per car: the customer booked a
      // transfer, not four of them. So it carries what the journey costs and
      // how many people are travelling, rather than one vehicle's share.
      totalAmount:      body.totalAmount * body.vehicleCount,
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

    /**
     * A confirmation for each of the other rides.
     *
     * One email per ride rather than a list on the first, because the useful
     * half of a confirmation is where to be and how the chauffeur will find
     * you, and that is different for every journey. What they do not repeat is
     * the money: the fare for the whole arrangement is charged once, on the
     * link in the first email, and each of these says so rather than leaving
     * the customer to wonder whether another payment is due.
     */
    if (body.sendEmail) for (const b of extraBookings) {
      sendBookingConfirmation({
        to:               body.guestEmail,
        name:             body.guestName,
        confirmationCode: b.confirmationCode,
        pickupAddress:    b.ride.pickupAddress,
        dropoffAddress:   b.ride.dropoffAddress || "",
        pickupDatetime:   formatPickupDateTime(b.at),
        vehicleClass:     b.ride.vehicleClass,
        // As above: the journey's cost and party, not one car's share.
        totalAmount:      b.ride.totalAmount * b.ride.vehicleCount,
        passengers:       b.ride.passengers ?? body.passengers,
        bookingId:        b.id,
        payment: {
          line: body.paymentStatus === "PAID"
            ? `Paid, together with booking ${booking.confirmationCode}.`
            : `Charged with booking ${booking.confirmationCode} — nothing to pay for this ride on its own.`,
          paid: body.paymentStatus === "PAID",
        },
        calendar: calendarLinks({ id: b.id, confirmationCode: b.confirmationCode, pickupAddress: b.ride.pickupAddress, dropoffAddress: b.ride.dropoffAddress, pickupDatetime: b.at }),
        // They have several rides already; do not sell them another.
        returnUrl: null,
      }).catch(e => console.error("[resend] admin extra ride confirmation:", e));
    }

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
      totalAmount:      body.totalAmount * body.vehicleCount,
      passengers:       body.passengers,
      luggage:          body.luggage,
      flightNumber:     body.flightNumber,
      // The office needs to see at a glance that this one needs four cars.
      specialRequests:  vehicleNote(body.specialRequests, 0, body.vehicleCount, booking.confirmationCode),
    }).catch(() => {});

    return NextResponse.json({
      ...booking,
      payUrl,
      returnConfirmationCode: returnBooking?.confirmationCode ?? null,
      extraConfirmationCodes: extraBookings.map((b) => b.confirmationCode),
      // The further cars on each journey, so the office is told the real count.
      siblingConfirmationCodes: siblings.map((b) => b.confirmationCode),
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
