import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation } from "@/lib/resend";
import Stripe from "stripe";

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;
    if (!bookingId) return NextResponse.json({ ok: true });

    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus:  "PAID",
        status:         "CONFIRMED",
        stripePaymentId: session.payment_intent as string,
      },
    });

    await prisma.payment.upsert({
      where: { bookingId },
      update: { status: "PAID", stripePaymentId: session.payment_intent as string },
      create: {
        bookingId,
        stripeSessionId:  session.id,
        stripePaymentId:  session.payment_intent as string,
        amount:           (session.amount_total ?? 0) / 100,
        currency:         session.currency ?? "eur",
        status:           "PAID",
      },
    });

    // Send confirmation email
    const email = session.customer_email ?? booking.guestEmail;
    if (email) {
      await sendBookingConfirmation({
        to:               email,
        name:             booking.guestName ?? "Valued Client",
        confirmationCode: booking.confirmationCode,
        pickupAddress:    booking.pickupAddress,
        dropoffAddress:   booking.dropoffAddress,
        pickupDatetime:   booking.pickupDatetime.toLocaleString("en-GB"),
        vehicleClass:     booking.vehicleClass,
        totalAmount:      booking.totalAmount,
        passengers:       booking.passengers,
      }).catch(console.error);
    }
  }

  if (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") {
    const obj = event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent;
    const bookingId = obj.metadata?.bookingId;
    if (bookingId) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentStatus: "FAILED" },
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
