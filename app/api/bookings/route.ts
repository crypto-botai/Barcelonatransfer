import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSumUpCheckout, getSumUpCheckoutUrl } from "@/lib/sumup";
import { sendAdminNewBookingAlert, sendBookingConfirmation, sendWelcomeEmail } from "@/lib/resend";
import { redeemCoupon, validateCoupon } from "@/lib/marketing";
import { calculateLastMinuteSurcharge, HOURLY_RATES, MIN_HOURLY_HOURS, AIRPORT_SURCHARGE, NIGHT_SURCHARGE_RATE, MIN_BOOKING_HOURS } from "@/lib/pricing";
import { getQuote } from "@/lib/pricing-service";
import { pickupToUtc, formatPickupDateTime } from "@/lib/datetime";
import { isAirportLocation, isNightTime } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { withUniqueBookingCode } from "@/lib/booking-code";
import { FLEET_TO_DB_CLASS, type VehicleClass, type FleetVehicle } from "@/types";
import { roadDistance, resolveEndpoint } from "@/lib/geo";
import { extrasCostFor, resolveTier, type MemberTier } from "@/lib/loyalty";

/**
 * Membership tier of whoever is booking.
 *
 * Guests book without an account and pay the full extras price; there is no
 * tier to read. A profile read that fails must not take the booking down with
 * it, so any error simply prices the extras at Silver.
 */
async function tierForUser(userId: string | undefined): Promise<MemberTier> {
  if (!userId) return "Silver";
  try {
    const profile = await prisma.customerProfile.findUnique({
      where:  { userId },
      select: { isVip: true, totalSpent: true },
    });
    return resolveTier(profile?.totalSpent ?? 0, profile?.isVip ?? false);
  } catch {
    return "Silver";
  }
}

function generatePassword(len = 10): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const extraSchema = z.object({
  id:       z.string(),
  label:    z.string(),
  price:    z.number(),
  quantity: z.number().int().min(1).default(1),
});

const schema = z.object({
  couponCode:      z.string().optional(),
  bookingType:     z.enum(["TRANSFER", "HOURLY", "DAY_HIRE", "CORPORATE"]).default("TRANSFER"),
  pickupAddress:   z.string().min(3),
  pickupLat:       z.number(),
  pickupLng:       z.number(),
  dropoffAddress:  z.string().default(""),
  dropoffLat:      z.number().default(0),
  dropoffLng:      z.number().default(0),
  date:            z.string(),
  time:            z.string(),
  passengers:      z.number().int().min(1),
  luggage:         z.number().int().min(0),
  vehicleClass:    z.string(),
  fleetVehicle:    z.string().optional(),
  durationHours:   z.number().int().min(1).max(24).optional(),
  flightNumber:    z.string().optional(),
  specialRequests: z.string().optional(),
  extras:          z.array(extraSchema).optional(),
  guestName:       z.string().min(2),
  guestEmail:      z.string().email(),
  guestPhone:      z.string().min(6),
  quote: z.object({
    distanceKm:          z.number(),
    durationMin:         z.number(),
    baseFare:            z.number(),
    distanceFare:        z.number(),
    airportSurcharge:    z.number(),
    nightSurcharge:      z.number(),
    lastMinuteSurcharge: z.number().default(0),
    vatAmount:           z.number().default(0),
    totalAmount:         z.number(),
  }),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string };
  const bookings = await prisma.booking.findMany({
    where: { userId: user.id, isDeleted: false },
    orderBy: { pickupDatetime: "desc" },
    select: {
      id: true, confirmationCode: true, status: true, paymentStatus: true,
      pickupAddress: true, dropoffAddress: true, pickupDatetime: true,
      vehicleClass: true, passengers: true, luggage: true, totalAmount: true,
      flightNumber: true, createdAt: true,
      driver: {
        select: {
          user: { select: { name: true, image: true } },
          rating: true,
          vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } },
        },
      },
    },
  });
  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user    = session?.user as { id?: string } | undefined;
    // A non-JSON body throws here, before zod runs, so it would otherwise
    // escape the ZodError branch below and be reported as a server error.
    const raw = await req.json().catch(() => null);
    if (raw === null) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const body    = schema.parse(raw);

    // The one conversion in the pipeline. The picker gives a wall-clock date and
    // time with no zone; on a Barcelona website that means Barcelona. Parsing it
    // with `new Date()` read it as the server's zone — UTC on Vercel — and
    // stored every pickup one or two hours early, depending on the season.
    const pickupDatetime = pickupToUtc(body.date, body.time);
    if (!pickupDatetime) {
      return NextResponse.json({ error: "Invalid date or time" }, { status: 422 });
    }

    // Block bookings with < 1h notice
    const minsUntilPickup = (pickupDatetime.getTime() - Date.now()) / 60_000;
    if (minsUntilPickup < MIN_BOOKING_HOURS * 60) {
      return NextResponse.json({
        error: `Bookings require at least ${MIN_BOOKING_HOURS} hour notice. For urgent transfers, please call or WhatsApp us at +34 635 383 712.`,
      }, { status: 422 });
    }

    // Server-side price recalculation (authoritative — client amount is advisory only)
    const vc = body.vehicleClass as VehicleClass;
    let serverBaseTotal: number;

    // The price breakdown stored on the booking must come from the server, not
    // the request. totalAmount was already recomputed here, but the line items
    // were taken verbatim from the client — so a tampered baseFare printed on
    // the customer's invoice next to a correct total, and the two contradicted
    // each other on a tax document.
    let breakdown = {
      distanceKm: 0, durationMin: 0,
      baseFare: 0, distanceFare: 0, airportSurcharge: 0, nightSurcharge: 0,
    };

    if (body.bookingType === "HOURLY" || body.bookingType === "DAY_HIRE") {
      const minH  = MIN_HOURLY_HOURS[vc] ?? 4;
      const hours = body.bookingType === "DAY_HIRE" ? 8 : Math.max(body.durationHours ?? 4, minH);
      const hourlyRate = HOURLY_RATES[vc] ?? 50;
      const subtotal = hourlyRate * hours;
      const nightSurcharge = isNightTime(pickupDatetime) ? subtotal * NIGHT_SURCHARGE_RATE : 0;
      const airportSurcharge = isAirportLocation(body.pickupLat, body.pickupLng) ? AIRPORT_SURCHARGE : 0;
      serverBaseTotal = Math.round((subtotal + nightSurcharge + airportSurcharge) * 100) / 100;
      breakdown = {
        distanceKm: 0, durationMin: hours * 60,
        baseFare: subtotal, distanceFare: 0,
        airportSurcharge, nightSurcharge: Math.round(nightSurcharge * 100) / 100,
      };
    } else {
      // Distance is measured server-side, never taken from the request.
      //
      // For a table route the distance is only informational, but a per-km fare
      // is computed directly from it — so trusting body.quote.distanceKm would
      // let a caller post distanceKm: 1 for a 200 km journey and pay the €50
      // minimum. Coordinates are resolved from the address text when the client
      // did not send any, for the same reason the quote endpoint does it.
      const [from, to] = await Promise.all([
        resolveEndpoint(body.pickupLat,  body.pickupLng,  body.pickupAddress),
        resolveEndpoint(body.dropoffLat, body.dropoffLng, body.dropoffAddress),
      ]);

      const measured = from && to
        ? await roadDistance(from, to)
        : { distanceKm: 0, durationMin: 0, precise: false };

      const sq = await getQuote({
        pickupLat:      from?.lat ?? body.pickupLat,
        pickupLng:      from?.lng ?? body.pickupLng,
        dropoffLat:     to?.lat   ?? body.dropoffLat,
        dropoffLng:     to?.lng   ?? body.dropoffLng,
        vehicleClass:   vc,
        // Same per-car price the quote widget showed, validated the same way,
        // so the figure the customer accepted is the figure that is charged.
        fleetVehicle:   body.fleetVehicle && body.fleetVehicle in FLEET_TO_DB_CLASS
          ? (body.fleetVehicle as FleetVehicle)
          : undefined,
        pickupDatetime,
        distanceKm:     measured.distanceKm,
        durationMin:    measured.durationMin,
        pickupAddress:  body.pickupAddress || undefined,
        dropoffAddress: body.dropoffAddress || undefined,
      });
      // A route with no table row is now priced per kilometre and is bookable.
      // Only a journey we could not price at all — no dropoff coordinates, so
      // no distance to work from — still needs a human.
      if (sq.needsManualQuote || sq.totalAmount <= 0) {
        return NextResponse.json(
          { error: "We could not calculate a price for this route. Please contact us via WhatsApp." },
          { status: 422 }
        );
      }
      // sq.totalAmount already includes last-minute surcharge from getQuote
      serverBaseTotal = sq.totalAmount;
      breakdown = {
        distanceKm:       measured.distanceKm,
        durationMin:      measured.durationMin,
        baseFare:         sq.baseFare,
        distanceFare:     sq.distanceFare,
        airportSurcharge: sq.airportSurcharge,
        nightSurcharge:   sq.nightSurcharge,
      };
    }

    // Apply last-minute surcharge for HOURLY/DAY_HIRE (TRANSFER already has it from getQuote)
    const lmSurcharge = (body.bookingType === "HOURLY" || body.bookingType === "DAY_HIRE")
      ? calculateLastMinuteSurcharge(serverBaseTotal, pickupDatetime)
      : 0;
    const serverTotal = Math.round((serverBaseTotal + lmSurcharge) * 100) / 100;

    // Coupon discount (validate server-side)
    const couponResult = body.couponCode
      ? await validateCoupon(body.couponCode, body.guestEmail).catch(() => null)
      : null;
    const couponDiscountPct = couponResult?.valid
      ? (couponResult as { coupon?: { discountPct?: number } }).coupon?.discountPct ?? 0
      : 0;
    const couponDiscount = couponDiscountPct > 0
      ? Math.round(serverTotal * (couponDiscountPct / 100) * 100) / 100
      : 0;

    // Priced server-side from EXTRAS_CATALOG, and with the booker's tier applied
    // so Gold's meet & greet is actually free rather than merely advertised.
    //
    // The old line multiplied the price the *client* sent by the quantity it
    // sent. Nothing checked either against the catalogue, so a crafted request
    // could attach an extra at a negative price and pay less than the fare.
    const tier = await tierForUser(user?.id);
    const extrasCost = extrasCostFor(body.extras, tier);
    const totalWithExtras = Math.round((serverTotal + extrasCost - couponDiscount) * 100) / 100;

    // Encode booking metadata into specialRequests.
    //
    // The stored extras carry the catalogue price actually charged, not the
    // price the client sent, so the record and the receipt agree. A waived
    // extra is stored at 0 with the tier that earned it, which is what makes a
    // €0 line on the confirmation explicable later.
    const pricedExtras = (body.extras ?? []).map((e) => ({
      ...e,
      price: extrasCostFor([{ ...e, quantity: 1 }], tier),
    }));
    const metaObj = {
      bookingType:  body.bookingType,
      durationHours: body.durationHours ?? null,
      extras:       pricedExtras,
      extrasCost,
      memberTier:   tier,
    };
    const metaPrefix = `[META]${JSON.stringify(metaObj)}[/META]\n`;
    const specialRequests = body.specialRequests
      ? `${metaPrefix}${body.specialRequests}`
      : metaPrefix.trimEnd();

    // Step 1: Always create the booking record first
    let booking;
    try {
      // Wrapped so a confirmation-code collision retries instead of 500ing and
      // losing the booking (and with it the confirmation and admin alert
      // emails, which are sent further down this same request).
      booking = await withUniqueBookingCode((confirmationCode) => prisma.booking.create({
        data: {
          confirmationCode,
          userId:           user?.id ?? null,
          guestName:        body.guestName,
          guestEmail:       body.guestEmail,
          guestPhone:       body.guestPhone,
          pickupAddress:    body.pickupAddress,
          pickupLat:        body.pickupLat,
          pickupLng:        body.pickupLng,
          dropoffAddress:   body.dropoffAddress,
          dropoffLat:       body.dropoffLat,
          dropoffLng:       body.dropoffLng,
          pickupDatetime,
          passengers:       body.passengers,
          luggage:          body.luggage,
          vehicleClass:     body.vehicleClass as VehicleClass,
          flightNumber:     body.flightNumber ?? null,
          specialRequests,
          distanceKm:       breakdown.distanceKm,
          durationMin:      Math.round(breakdown.durationMin),
          baseFare:         breakdown.baseFare,
          distanceFare:     breakdown.distanceFare,
          airportSurcharge: breakdown.airportSurcharge,
          nightSurcharge:   breakdown.nightSurcharge,
          totalAmount:      totalWithExtras,
          status:           "PENDING",
          paymentStatus:    "PENDING",
        },
      }));
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      console.error("[bookings] DB create failed:", msg, dbErr);
      return NextResponse.json({ error: `Could not save booking: ${msg}` }, { status: 500 });
    }

    // Step 2: Auto-create user account for guest if not already registered
    let accountCreated = false;
    let accountPassword = "";
    if (!user?.id) {
      const existingUser = await prisma.user.findUnique({ where: { email: body.guestEmail } });
      if (!existingUser) {
        accountPassword = generatePassword();
        const hash = await bcrypt.hash(accountPassword, 12);
        const newUser = await prisma.user.create({
          data: {
            name:               body.guestName,
            email:              body.guestEmail,
            phone:              body.guestPhone,
            passwordHash:       hash,
            role:               "CUSTOMER",
            mustChangePassword: true,
          },
        });
        await prisma.booking.update({
          where: { id: booking.id },
          data:  { userId: newUser.id },
        });
        accountCreated = true;
        await sendWelcomeEmail({
          to:               body.guestEmail,
          name:             body.guestName,
          password:         accountPassword,
          confirmationCode: booking.confirmationCode,
          totalAmount:      totalWithExtras,
        }).catch(e => console.error("[bookings/welcome-email]", e?.message ?? e));
      } else {
        // Link booking to existing user
        await prisma.booking.update({
          where: { id: booking.id },
          data:  { userId: existingUser.id },
        });
      }
    }

    // Step 2b: Mark any abandoned booking as converted (booking = intent to pay)
    const now = new Date();
    await prisma.abandonedBooking.updateMany({
      where: { email: body.guestEmail, convertedAt: null },
      data:  { convertedAt: now },
    }).catch(() => {});

    // Mark booking session as converted
    await prisma.bookingSession.updateMany({
      where: { email: body.guestEmail, converted: false },
      data:  { converted: true },
    }).catch(() => {});

    // Redeem coupon if valid
    if (body.couponCode && couponResult?.valid) {
      await redeemCoupon(body.couponCode, booking.id).catch(() => {});
    }

    // Step 2c & 3: Send emails — awaited so Vercel doesn't kill them before response
    const [confResult, adminResult] = await Promise.allSettled([
      sendBookingConfirmation({
        to:               body.guestEmail,
        name:             body.guestName,
        confirmationCode: booking.confirmationCode,
        pickupAddress:    body.pickupAddress,
        dropoffAddress:   body.dropoffAddress || body.bookingType,
        pickupDatetime:   formatPickupDateTime(pickupDatetime),
        vehicleClass:     body.vehicleClass,
        totalAmount:      totalWithExtras,
        passengers:       body.passengers,
        bookingId:        booking.id,
      }),
      sendAdminNewBookingAlert({
        confirmationCode: booking.confirmationCode,
        guestName:        body.guestName,
        guestEmail:       body.guestEmail,
        guestPhone:       body.guestPhone,
        pickupAddress:    body.pickupAddress,
        dropoffAddress:   body.dropoffAddress || `${body.bookingType} – ${body.durationHours ?? ""}h`,
        pickupDatetime:   formatPickupDateTime(pickupDatetime),
        vehicleClass:     body.vehicleClass,
        totalAmount:      totalWithExtras,
        passengers:       body.passengers,
        luggage:          body.luggage,
        flightNumber:     body.flightNumber,
        specialRequests:  specialRequests,
      }),
    ]);
    if (confResult.status === "rejected")  console.error("[bookings/confirmation-email]", confResult.reason);
    if (adminResult.status === "rejected") console.error("[bookings/admin-alert-email]", adminResult.reason);

    // Step 4: Try to create SumUp checkout — if not configured, use WhatsApp fallback
    const sumupConfigured =
      !!process.env.SUMUP_API_KEY && process.env.SUMUP_API_KEY !== "your_sumup_api_key" &&
      !!process.env.SUMUP_MERCHANT_CODE && process.env.SUMUP_MERCHANT_CODE !== "your_merchant_code";

    if (sumupConfigured) {
      try {
        const checkout = await createSumUpCheckout({
          bookingId:     booking.id,
          amount:        totalWithExtras,
          description:   `Elite BCN: ${body.pickupAddress} → ${body.dropoffAddress || body.bookingType}`,
          customerEmail: body.guestEmail,
        });

        await prisma.booking.update({
          where: { id: booking.id },
          data:  { stripeSessionId: checkout.id },
        });

        return NextResponse.json({
          bookingId:    booking.id,
          checkoutId:   checkout.id,
          checkoutUrl:  getSumUpCheckoutUrl(checkout.id, booking.id),
          accountCreated,
          email:        accountCreated ? body.guestEmail : undefined,
          tempPassword: accountCreated ? accountPassword : undefined,
        });
      } catch (sumupErr) {
        const errMsg = sumupErr instanceof Error ? sumupErr.message : String(sumupErr);
        console.error("[bookings] SumUp checkout failed:", errMsg);
        return NextResponse.json({
          bookingId:    booking.id,
          checkoutUrl:  `/booking/success?booking_id=${booking.id}`,
          accountCreated,
          email:        accountCreated ? body.guestEmail : undefined,
          tempPassword: accountCreated ? accountPassword : undefined,
          sumupError:   errMsg,
        });
      }
    }

    // Fallback: SumUp not configured — redirect to pending page
    return NextResponse.json({
      bookingId:    booking.id,
      checkoutUrl:  `/booking/success?booking_id=${booking.id}`,
      accountCreated,
      email:        accountCreated ? body.guestEmail : undefined,
      tempPassword: accountCreated ? accountPassword : undefined,
      sumupError:   "SumUp not configured",
    });

  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bookings/POST]", msg, err);
    return NextResponse.json({ error: msg || "Booking failed" }, { status: 500 });
  }
}
