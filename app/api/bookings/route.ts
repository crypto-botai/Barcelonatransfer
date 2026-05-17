import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";
import { sendAdminNewBookingAlert } from "@/lib/resend";
import { z } from "zod";
import { type VehicleClass } from "@/types";

const schema = z.object({
  pickupAddress:    z.string().min(3),
  pickupLat:        z.number(),
  pickupLng:        z.number(),
  dropoffAddress:   z.string().min(3),
  dropoffLat:       z.number(),
  dropoffLng:       z.number(),
  date:             z.string(),
  time:             z.string(),
  passengers:       z.number().int().min(1),
  luggage:          z.number().int().min(0),
  vehicleClass:     z.string(),
  flightNumber:     z.string().optional(),
  specialRequests:  z.string().optional(),
  guestName:        z.string().min(2),
  guestEmail:       z.string().email(),
  guestPhone:       z.string().min(6),
  quote: z.object({
    distanceKm:       z.number(),
    durationMin:      z.number(),
    baseFare:         z.number(),
    distanceFare:     z.number(),
    airportSurcharge: z.number(),
    nightSurcharge:   z.number(),
    totalAmount:      z.number(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string } | undefined;
    const body = schema.parse(await req.json());

    const pickupDatetime = new Date(`${body.date}T${body.time}`);

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
        specialRequests:  body.specialRequests ?? null,
        distanceKm:       body.quote.distanceKm,
        durationMin:      body.quote.durationMin,
        baseFare:         body.quote.baseFare,
        distanceFare:     body.quote.distanceFare,
        airportSurcharge: body.quote.airportSurcharge,
        nightSurcharge:   body.quote.nightSurcharge,
        totalAmount:      body.quote.totalAmount,
        status:           "PENDING",
        paymentStatus:    "PENDING",
      },
    });

    // Create Stripe checkout session
    const checkoutSession = await createCheckoutSession({
      bookingId:     booking.id,
      amount:        body.quote.totalAmount,
      customerEmail: body.guestEmail,
      description:   `Élite BCN Transfer: ${body.pickupAddress} → ${body.dropoffAddress}`,
      metadata: {
        bookingCode: booking.confirmationCode,
        vehicle:     body.vehicleClass,
      },
    });

    // Update booking with Stripe session ID
    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeSessionId: checkoutSession.id },
    });

    // Notify admin (fire-and-forget)
    sendAdminNewBookingAlert({
      confirmationCode: booking.confirmationCode,
      guestName:        body.guestName,
      guestEmail:       body.guestEmail,
      pickupAddress:    body.pickupAddress,
      dropoffAddress:   body.dropoffAddress,
      pickupDatetime:   pickupDatetime.toLocaleString(),
      vehicleClass:     body.vehicleClass,
      totalAmount:      body.quote.totalAmount,
    }).catch(() => {});

    return NextResponse.json({ bookingId: booking.id, checkoutUrl: checkoutSession.url });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    console.error(err);
    return NextResponse.json({ error: "Booking failed" }, { status: 500 });
  }
}
