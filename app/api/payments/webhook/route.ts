import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPaymentConfirmationEmail, sendAdminNewBookingAlert, sendFailedPaymentEmail } from "@/lib/resend";
import crypto from "crypto";

// SumUp sends HMAC-SHA256 signature in X-Payload-Signature header
function verifySumUpSignature(payload: string, signature: string): boolean {
  const secret = process.env.SUMUP_WEBHOOK_SECRET;
  if (!secret) return true; // skip in dev if not configured
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature.replace("sha256=", ""), "hex")
  );
}

export async function POST(req: NextRequest) {
  const payload   = await req.text();
  const signature = req.headers.get("x-payload-signature") ?? "";

  if (signature && !verifySumUpSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = (event.event_type ?? event.type) as string;
  const data      = (event.payload ?? event.data ?? event) as Record<string, unknown>;

  // SumUp checkout webhook: event_type = "checkout.updated"
  if (eventType === "checkout.updated" || data?.status) {
    const checkoutId = (data.id ?? data.checkout_id) as string;
    const status     = (data.status) as string;

    if (!checkoutId) return NextResponse.json({ ok: true });

    const booking = await prisma.booking.findFirst({
      where: { stripeSessionId: checkoutId },
    });

    if (!booking) return NextResponse.json({ ok: true });

    if (status === "PAID") {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus:   "PAID",
          status:          "CONFIRMED",
          stripePaymentId: (data.transaction_id ?? checkoutId) as string,
        },
      });

      await prisma.payment.upsert({
        where:  { bookingId: booking.id },
        update: { status: "PAID", stripePaymentId: (data.transaction_id ?? checkoutId) as string },
        create: {
          bookingId:       booking.id,
          stripeSessionId: checkoutId,
          stripePaymentId: (data.transaction_id ?? checkoutId) as string,
          amount:          updated.totalAmount,
          currency:        updated.currency,
          status:          "PAID",
        },
      });

      const email = updated.guestEmail;
      if (email) {
        // Dedup: skip if payment confirmation already sent for this booking
        const alreadySent = await prisma.emailLog.findFirst({
          where: { bookingId: booking.id, type: "PAYMENT_CONFIRMATION" },
        }).catch(() => null);

        if (!alreadySent) {
          const transactionId = (data.transaction_id ?? checkoutId) as string;
          sendPaymentConfirmationEmail({
            to:               email,
            name:             updated.guestName ?? "Valued Client",
            confirmationCode: updated.confirmationCode,
            pickupAddress:    updated.pickupAddress,
            dropoffAddress:   updated.dropoffAddress,
            pickupDatetime:   updated.pickupDatetime.toLocaleString("en-GB"),
            vehicleClass:     updated.vehicleClass,
            totalAmount:      updated.totalAmount,
            passengers:       updated.passengers,
            bookingId:        booking.id,
            transactionId,
          }).catch(e => console.error("[resend] payment confirmation (webhook):", e));

          sendAdminNewBookingAlert({
            confirmationCode: updated.confirmationCode,
            guestName:        updated.guestName ?? "Guest",
            guestEmail:       email,
            pickupAddress:    updated.pickupAddress,
            dropoffAddress:   updated.dropoffAddress ?? "",
            pickupDatetime:   updated.pickupDatetime.toLocaleString("en-GB"),
            vehicleClass:     updated.vehicleClass,
            totalAmount:      updated.totalAmount,
          }).catch(e => console.error("[resend] admin alert (webhook):", e));
        }
      }
    } else if (status === "FAILED" || status === "EXPIRED") {
      const failedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data:  { paymentStatus: "FAILED" },
      }).catch(() => null);

      if (failedBooking?.guestEmail) {
        sendFailedPaymentEmail({
          to:               failedBooking.guestEmail,
          name:             failedBooking.guestName ?? "Valued Client",
          confirmationCode: failedBooking.confirmationCode,
          bookingId:        failedBooking.id,
        }).catch(e => console.error("[resend] failed payment (webhook):", e));
      }
    }
  }

  return NextResponse.json({ ok: true });
}
