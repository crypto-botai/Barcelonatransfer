import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { type VehicleClass } from "@/types";
import { sendBookingConfirmation, sendJourneysConfirmation, sendAdminNewBookingAlert } from "@/lib/resend";
import { togetherNote } from "@/lib/journeys";
import { notify } from "@/lib/notifications/service";
import { BASE_URL } from "@/lib/seo";
import { withUniqueBookingCode } from "@/lib/booking-code";
import { parsePickupInput, formatPickupDateTime } from "@/lib/datetime";
import { createSumUpCheckout, getSumUpCheckoutUrl } from "@/lib/sumup";
import { PAYMENT_METHODS, paymentLine } from "@/lib/payment-method";
import { calendarLinks, returnTripUrl } from "@/lib/calendar";
import { seatShare, vehicleNote } from "@/lib/vehicle-group";
import { MAX_STOPS } from "@/lib/booking-meta";

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
    // Soonest pickup first. The list is re-ordered in the browser too
    // (lib/booking-order), but a caller that does not sort should still get
    // something useful rather than the order the office typed them in.
    orderBy: { pickupDatetime: "asc" },
    take: limit,
    include: {
      driver:  { include: { user: { select: { name: true, phone: true } }, vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } } } },
      user:    { select: { name: true, email: true } },
      partner: { select: { name: true } },
    },
  });

  return NextResponse.json(bookings);
}

/**
 * Writes the stop addresses into the booking's metadata block.
 *
 * Stops live in the same [META] prefix on specialRequests that the customer
 * checkout already uses, so parseBookingMeta reads them on an office booking
 * exactly as it does on a customer one and nothing needed a new column.
 * Returns the note untouched when there are no stops, so an ordinary booking
 * is stored exactly as it was before.
 */
function withStops(specialRequests: string | undefined, stops: string[] | undefined): string | undefined {
  const clean = (stops ?? []).map((v) => v.trim()).filter(Boolean).slice(0, MAX_STOPS);
  if (clean.length === 0) return specialRequests;
  const prefix = `[META]${JSON.stringify({ stops: clean })}[/META]
`;
  return specialRequests ? `${prefix}${specialRequests}` : prefix;
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
  /**
   * Addresses the car calls at on the way, in order. The catalogue sells at
   * most three, and an empty string is a half-filled form field rather than
   * a place, so both are trimmed away before anything is stored.
   */
  stops:           z.array(z.string().trim().min(3)).max(MAX_STOPS).optional(),
  totalAmount:     z.number().min(0),
  /**
   * What the customer has already paid online, when the office is recording
   * a booking that was part-paid. The rest is collected by the chauffeur on
   * the day. Left out entirely for a booking paid in full or not at all,
   * which keeps those behaving exactly as before.
   */
  depositAmount:   z.number().min(0).optional(),
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
   * Also put the confirmation on the customer's phone. Off by default so that
   * nothing that already calls this route starts sending texts it was not
   * written to send; the admin form turns them on when they are configured.
   */
  sendSms:         z.boolean().default(false),
  sendWhatsApp:    z.boolean().default(false),
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

    /**
     * A part-paid booking: some taken online, the rest from the chauffeur.
     *
     * Only a deposit strictly between zero and the total splits the booking.
     * A deposit of zero is no deposit, and one at or above the total is a
     * booking paid in full — both leave these columns null and behave as
     * they always did. The balance is derived rather than accepted from the
     * client so the two figures cannot disagree.
     */
    const deposit = body.depositAmount ?? 0;
    const isSplit = deposit > 0 && deposit < body.totalAmount;
    const depositFields = isSplit
      ? {
          depositAmount: Math.round(deposit * 100) / 100,
          balanceAmount: Math.round((body.totalAmount - deposit) * 100) / 100,
          // Nobody has collected it yet; the chauffeur marks it on the day.
          balancePaidAt: null,
          balanceMethod: null,
          balancePaidBy: null,
        }
      : {};

    // Everything below writes the same fields whether the row is new or an
    // unpaid one being finished off, so the two paths cannot drift apart.
    const fields = {
      ...depositFields,
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
      specialRequests: withStops(body.specialRequests, body.stops),
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
          specialRequests: togetherNote(booking.confirmationCode, ride.specialRequests),
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
        togetherNote(booking.confirmationCode, ride.specialRequests),
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

    /**
     * One email for the whole arrangement.
     *
     * A return, or any extra ride, used to go out as a separate email each, and
     * the one carrying the payment link named only the first. With more than
     * one journey they are now listed together, in the order they are travelled,
     * with one total and one pay button. A single journey keeps its own email.
     */
    const multi = !!returnBooking || extraBookings.length > 0;
    if (body.sendEmail && multi) {
      const outboundCars = body.vehicleCount;
      const backCars = body.returnVehicleCount ?? body.vehicleCount;
      after(() => sendJourneysConfirmation({
        to:          body.guestEmail,
        name:        body.guestName,
        stage:       body.paymentStatus === "PAID" ? "confirmed" : "received",
        totalAmount: tripTotal,
        bookingId:   booking.id,
        logType:     "CONFIRMATION",
        payment,
        arrivalFrom: { pickupAddress: body.pickupAddress },
        journeys: [
          {
            role: "outbound", confirmationCode: booking.confirmationCode,
            pickupAddress: body.pickupAddress, dropoffAddress: body.dropoffAddress || "",
            at: pickup, vehicleClass: body.vehicleClass, passengers: body.passengers,
            fare: body.totalAmount * outboundCars,
            calendar: calendarLinks({ id: booking.id, confirmationCode: booking.confirmationCode, pickupAddress: body.pickupAddress, dropoffAddress: body.dropoffAddress, pickupDatetime: pickup }),
          },
          ...(returnBooking && back ? [{
            role: "return" as const, confirmationCode: returnBooking.confirmationCode,
            // Reversed, which is what the customer is expecting to read.
            pickupAddress: body.returnPickupAddress || body.dropoffAddress || body.pickupAddress,
            dropoffAddress: body.returnDropoffAddress || body.pickupAddress,
            at: back, vehicleClass: body.vehicleClass, passengers: body.passengers,
            fare: returnFare * backCars,
            calendar: calendarLinks({ id: returnBooking.id, confirmationCode: returnBooking.confirmationCode, pickupAddress: body.dropoffAddress || body.pickupAddress, dropoffAddress: body.pickupAddress, pickupDatetime: back }),
          }] : []),
          ...extraBookings.map((b) => ({
            role: "extra" as const, confirmationCode: b.confirmationCode,
            pickupAddress: b.ride.pickupAddress, dropoffAddress: b.ride.dropoffAddress || "",
            at: b.at, vehicleClass: b.ride.vehicleClass, passengers: b.ride.passengers ?? body.passengers,
            fare: b.ride.totalAmount * b.ride.vehicleCount,
            calendar: calendarLinks({ id: b.id, confirmationCode: b.confirmationCode, pickupAddress: b.ride.pickupAddress, dropoffAddress: b.ride.dropoffAddress, pickupDatetime: b.at }),
          })),
        ],
      }).catch(e => console.error("[resend] admin journeys confirmation:", e)));
    }

    // Notify customer: the single-journey email, unchanged.
    if (body.sendEmail && !multi) after(() => sendBookingConfirmation({
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
    }).catch(e => console.error("[resend] admin create booking confirmation:", e)));

    /**
     * The confirmation on the customer's phone, for the booking they asked for.
     *
     * One message for the journey rather than one per ride, the same as the
     * money: the extra rides each get their own email, but a text for every leg
     * of a four-car booking would cost more than it helps. notify() never
     * throws and records what happened, so a number that cannot be reached
     * leaves a reason in the audit log and cannot fail the booking.
     */
    const phoneChannels = [
      ...(body.sendSms ? ["sms" as const] : []),
      ...(body.sendWhatsApp ? ["whatsapp" as const] : []),
    ];
    if (phoneChannels.length) {
      after(() => notify({
        event:     "BOOKING_CONFIRMED",
        channels:  phoneChannels,
        userId:    booking.userId,
        bookingId: booking.id,
        phone:     body.guestPhone,
        vars: {
          code:  booking.confirmationCode,
          when:  formatPickupDateTime(pickup),
          route: body.dropoffAddress ? `${body.pickupAddress} → ${body.dropoffAddress}` : body.pickupAddress,
          link:  `${BASE_URL}/track/${booking.confirmationCode}`,
        },
      }).catch((e) => console.error("[admin create booking] phone confirmation:", e)));
    }

    // Notify admin panel (useful if another admin created it)
    after(() => sendAdminNewBookingAlert({
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
    }).catch(() => {}));

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
