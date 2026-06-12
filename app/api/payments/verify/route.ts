import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSumUpCheckout } from "@/lib/sumup";
import { sendPaymentConfirmationEmail, sendAdminNewBookingAlert } from "@/lib/resend";
import { sendWhatsAppBookingConfirmation } from "@/lib/whatsapp";

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
          // Mark any abandoned booking as converted now that payment succeeded
          await prisma.abandonedBooking.updateMany({
            where: { email: updated.guestEmail, convertedAt: null },
            data:  { convertedAt: new Date() },
          }).catch(() => {});
          await prisma.bookingSession.updateMany({
            where: { email: updated.guestEmail, converted: false },
            data:  { converted: true },
          }).catch(() => {});

          // Dedup: skip if payment confirmation already sent for this booking
          const alreadySent = await prisma.emailLog.findFirst({
            where: { bookingId, type: "PAYMENT_CONFIRMATION" },
          }).catch(() => null);

          if (!alreadySent) {
            const transactionId = checkout.transaction_id ?? checkout.id;
            const route = updated.dropoffAddress
              ? `${updated.pickupAddress} → ${updated.dropoffAddress}`
              : updated.pickupAddress;

            // Await both emails — fire-and-forget kills on Vercel serverless
            const [custResult, adminResult] = await Promise.allSettled([
              sendPaymentConfirmationEmail({
                to:               updated.guestEmail,
                name:             updated.guestName ?? "Valued Client",
                confirmationCode: updated.confirmationCode,
                pickupAddress:    updated.pickupAddress,
                dropoffAddress:   updated.dropoffAddress,
                pickupDatetime:   updated.pickupDatetime.toLocaleString("en-GB"),
                vehicleClass:     updated.vehicleClass,
                totalAmount:      updated.totalAmount,
                passengers:       updated.passengers,
                bookingId,
                transactionId:    typeof transactionId === "string" ? transactionId : undefined,
              }),
              sendAdminNewBookingAlert({
                confirmationCode: updated.confirmationCode,
                guestName:        updated.guestName ?? "Guest",
                guestEmail:       updated.guestEmail,
                guestPhone:       updated.guestPhone ?? undefined,
                pickupAddress:    updated.pickupAddress,
                dropoffAddress:   updated.dropoffAddress ?? "",
                pickupDatetime:   updated.pickupDatetime.toLocaleString("en-GB"),
                vehicleClass:     updated.vehicleClass,
                totalAmount:      updated.totalAmount,
                passengers:       updated.passengers,
                specialRequests:  updated.specialRequests,
              }),
            ]);

            if (custResult.status === "rejected")
              console.error("[resend] customer email (verify):", custResult.reason);
            if (adminResult.status === "rejected")
              console.error("[resend] admin alert (verify):", adminResult.reason);

            // WhatsApp — isolated so failure never breaks the response
            if (updated.guestPhone) {
              try {
                await sendWhatsAppBookingConfirmation({
                  phone:           updated.guestPhone,
                  bookingRef:      updated.confirmationCode,
                  pickupDatetime:  updated.pickupDatetime.toLocaleString("en-GB"),
                  route,
                });
              } catch (waErr) {
                console.error("[whatsapp] booking confirmation (verify):", waErr);
              }
            }
          }
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
