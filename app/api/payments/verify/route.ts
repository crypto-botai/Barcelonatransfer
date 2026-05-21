import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSumUpCheckout } from "@/lib/sumup";
import { sendBookingConfirmation } from "@/lib/resend";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("booking_id");

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });
  }

  try {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // If already confirmed, just return
    if (booking.paymentStatus === "PAID") {
      return NextResponse.json({
        status: "PAID",
        confirmationCode: booking.confirmationCode,
        pickupAddress:    booking.pickupAddress,
        dropoffAddress:   booking.dropoffAddress,
        pickupDatetime:   booking.pickupDatetime,
        vehicleClass:     booking.vehicleClass,
        totalAmount:      booking.totalAmount,
        guestEmail:       booking.guestEmail,
      });
    }

    // Verify with SumUp API
    if (booking.stripeSessionId) {
      const checkout = await getSumUpCheckout(booking.stripeSessionId);

      if (checkout.status === "PAID") {
        const updated = await prisma.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus:   "PAID",
            status:          "CONFIRMED",
            stripePaymentId: checkout.transaction_id ?? checkout.id,
          },
        });

        await prisma.payment.upsert({
          where:  { bookingId },
          update: { status: "PAID", stripePaymentId: checkout.transaction_id ?? checkout.id },
          create: {
            bookingId,
            stripeSessionId: checkout.id,
            stripePaymentId: checkout.transaction_id ?? checkout.id,
            amount:          updated.totalAmount,
            currency:        updated.currency,
            status:          "PAID",
          },
        });

        if (updated.guestEmail) {
          sendBookingConfirmation({
            to:               updated.guestEmail,
            name:             updated.guestName ?? "Valued Client",
            confirmationCode: updated.confirmationCode,
            pickupAddress:    updated.pickupAddress,
            dropoffAddress:   updated.dropoffAddress,
            pickupDatetime:   updated.pickupDatetime.toLocaleString("en-GB"),
            vehicleClass:     updated.vehicleClass,
            totalAmount:      updated.totalAmount,
            passengers:       updated.passengers,
          }).catch(() => {});
        }

        return NextResponse.json({
          status:           "PAID",
          confirmationCode: updated.confirmationCode,
          pickupAddress:    updated.pickupAddress,
          dropoffAddress:   updated.dropoffAddress,
          pickupDatetime:   updated.pickupDatetime,
          vehicleClass:     updated.vehicleClass,
          totalAmount:      updated.totalAmount,
          guestEmail:       updated.guestEmail,
        });
      }

      if (checkout.status === "FAILED" || checkout.status === "EXPIRED") {
        await prisma.booking.update({
          where: { id: bookingId },
          data:  { paymentStatus: "FAILED" },
        });
        return NextResponse.json({ status: "FAILED" });
      }
    }

    // Return PENDING with booking details so the UI can show them
    return NextResponse.json({
      status:           "PENDING",
      confirmationCode: booking.confirmationCode,
      pickupAddress:    booking.pickupAddress,
      dropoffAddress:   booking.dropoffAddress,
      pickupDatetime:   booking.pickupDatetime,
      vehicleClass:     booking.vehicleClass,
      totalAmount:      booking.totalAmount,
      guestEmail:       booking.guestEmail,
      hasCheckout:      !!booking.stripeSessionId,
    });
  } catch (err) {
    console.error("[payments/verify]", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
