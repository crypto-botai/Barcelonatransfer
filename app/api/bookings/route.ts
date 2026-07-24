import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSumUpCheckout, getSumUpCheckoutUrl } from "@/lib/sumup";
import { sendAdminNewBookingAlert, sendBookingConfirmation, sendWelcomeEmail } from "@/lib/resend";
import { redeemCoupon, validateCoupon } from "@/lib/marketing";
import { calculateLastMinuteSurcharge, HOURLY_RATES, MIN_HOURLY_HOURS, AIRPORT_SURCHARGE, NIGHT_SURCHARGE_RATE, MIN_BOOKING_HOURS } from "@/lib/pricing";
import { getQuote } from "@/lib/pricing-service";
import { isAirportLocation, isNightTime } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { type VehicleClass } from "@/types";

function generateBookingCode(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const last6 = digits.slice(-6).padStart(6, "0");
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const suffix = Array.from({ length: 2 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `${last6}${suffix}`;
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
    const body    = schema.parse(await req.json());

    const pickupDatetime = new Date(`${body.date}T${body.time}`);
    if (isNaN(pickupDatetime.getTime())) {
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

    if (body.bookingType === "HOURLY" || body.bookingType === "DAY_HIRE") {
      const minH  = MIN_HOURLY_HOURS[vc] ?? 4;
      const hours = body.bookingType === "DAY_HIRE" ? 8 : Math.max(body.durationHours ?? 4, minH);
      const hourlyRate = HOURLY_RATES[vc] ?? 50;
      const subtotal = hourlyRate * hours;
      const nightSurcharge = isNightTime(pickupDatetime) ? subtotal * NIGHT_SURCHARGE_RATE : 0;
      const airportSurcharge = isAirportLocation(body.pickupLat, body.pickupLng) ? AIRPORT_SURCHARGE : 0;
      serverBaseTotal = Math.round((subtotal + nightSurcharge + airportSurcharge) * 100) / 100;
    } else {
      const sq = await getQuote({
        pickupLat:      body.pickupLat,
        pickupLng:      body.pickupLng,
        dropoffLat:     body.dropoffLat,
        dropoffLng:     body.dropoffLng,
        vehicleClass:   vc,
        pickupDatetime,
        distanceKm:     body.quote.distanceKm,
        durationMin:    Math.round(body.quote.durationMin),
        pickupAddress:  body.pickupAddress || undefined,
        dropoffAddress: body.dropoffAddress || undefined,
      });
      if (sq.isCustomRoute) {
        return NextResponse.json(
          { error: "This route requires a custom quote. Please contact us via WhatsApp." },
          { status: 422 }
        );
      }
      // sq.totalAmount already includes last-minute surcharge from getQuote
      serverBaseTotal = sq.totalAmount;
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

    const extrasCost = (body.extras ?? []).reduce((sum, e) => sum + e.price * e.quantity, 0);
    const totalWithExtras = Math.round((serverTotal + extrasCost - couponDiscount) * 100) / 100;

    // Encode booking metadata into specialRequests
    const metaObj = {
      bookingType:  body.bookingType,
      durationHours: body.durationHours ?? null,
      extras:       body.extras ?? [],
      extrasCost,
    };
    const metaPrefix = `[META]${JSON.stringify(metaObj)}[/META]\n`;
    const specialRequests = body.specialRequests
      ? `${metaPrefix}${body.specialRequests}`
      : metaPrefix.trimEnd();

    // Step 1: Always create the booking record first
    let booking;
    try {
      booking = await prisma.booking.create({
        data: {
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
          distanceKm:       body.quote.distanceKm,
          durationMin:      Math.round(body.quote.durationMin),
          baseFare:         body.quote.baseFare,
          distanceFare:     body.quote.distanceFare,
          airportSurcharge: body.quote.airportSurcharge,
          nightSurcharge:   body.quote.nightSurcharge,
          totalAmount:      totalWithExtras,
          confirmationCode: generateBookingCode(body.guestPhone),
          status:           "PENDING",
          paymentStatus:    "PENDING",
        },
      });
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
        pickupDatetime:   pickupDatetime.toLocaleString("en-GB"),
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
        pickupDatetime:   pickupDatetime.toLocaleString("en-GB"),
        vehicleClass:     body.vehicleClass,
        totalAmount:      totalWithExtras,
        passengers:       body.passengers,
        specialRequests:  body.specialRequests,
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
          description:   `Élite BCN: ${body.pickupAddress} → ${body.dropoffAddress || body.bookingType}`,
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
