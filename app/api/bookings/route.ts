import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSumUpCheckout, getSumUpCheckoutUrl } from "@/lib/sumup";
import { sendAdminNewBookingAlert } from "@/lib/resend";
import { z } from "zod";
import { type VehicleClass } from "@/types";

const extraSchema = z.object({
  id:       z.string(),
  label:    z.string(),
  price:    z.number(),
  quantity: z.number().int().min(1).default(1),
});

const schema = z.object({
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
    distanceKm:       z.number(),
    durationMin:      z.number(),
    baseFare:         z.number(),
    distanceFare:     z.number(),
    airportSurcharge: z.number(),
    nightSurcharge:   z.number(),
    vatAmount:        z.number().default(0),
    totalAmount:      z.number(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user    = session?.user as { id?: string } | undefined;
    const body    = schema.parse(await req.json());

    const pickupDatetime = new Date(`${body.date}T${body.time}`);
    const extrasCost     = (body.extras ?? []).reduce((sum, e) => sum + e.price * e.quantity, 0);
    const totalWithExtras = Math.round((body.quote.totalAmount + extrasCost) * 100) / 100;

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
    const booking = await prisma.booking.create({
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
        durationMin:      body.quote.durationMin,
        baseFare:         body.quote.baseFare,
        distanceFare:     body.quote.distanceFare,
        airportSurcharge: body.quote.airportSurcharge,
        nightSurcharge:   body.quote.nightSurcharge,
        totalAmount:      totalWithExtras,
        status:           "PENDING",
        paymentStatus:    "PENDING",
      },
    });

    // Step 2: Notify admin (fire-and-forget — never blocks)
    sendAdminNewBookingAlert({
      confirmationCode: booking.confirmationCode,
      guestName:        body.guestName,
      guestEmail:       body.guestEmail,
      pickupAddress:    body.pickupAddress,
      dropoffAddress:   body.dropoffAddress || `${body.bookingType} – ${body.durationHours ?? ""}h`,
      pickupDatetime:   pickupDatetime.toLocaleString("en-GB"),
      vehicleClass:     body.vehicleClass,
      totalAmount:      totalWithExtras,
    }).catch(() => {});

    // Step 3: Try to create SumUp checkout — if not configured, use WhatsApp fallback
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
          bookingId:   booking.id,
          checkoutUrl: getSumUpCheckoutUrl(checkout.id),
        });
      } catch (sumupErr) {
        console.error("[bookings] SumUp checkout failed:", sumupErr);
        // Fall through to WhatsApp fallback below
      }
    }

    // Fallback: booking is saved — redirect to success/pending page
    // Admin is already notified; customer can pay via WhatsApp
    return NextResponse.json({
      bookingId:   booking.id,
      checkoutUrl: `/booking/success?booking_id=${booking.id}`,
    });

  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    console.error("[bookings/POST]", err);
    return NextResponse.json({ error: "Booking failed" }, { status: 500 });
  }
}
