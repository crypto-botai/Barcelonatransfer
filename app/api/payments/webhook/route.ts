import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPaymentConfirmationEmail, sendAdminNewBookingAlert, sendFailedPaymentEmail } from "@/lib/resend";
import { sendWhatsAppBookingConfirmation } from "@/lib/whatsapp";
import crypto from "crypto";

// SumUp sends HMAC-SHA256 signature in X-Payload-Signature header
function verifySumUpSignature(payload: string, signature: string): boolean {
  const secret = process.env.SUMUP_WEBHOOK_SECRET;
  // Reject unsigned requests when secret is configured; allow in dev only
  if (!secret) return process.env.NODE_ENV !== "production";
  // Missing signature is always rejected
  if (!signature) return false;
  try {
    const expected    = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf      = Buffer.from(signature.replace("sha256=", ""), "hex");
    // timingSafeEqual throws on length mismatch — guard explicitly
    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const payload   = await req.text();
  const signature = req.headers.get("x-payload-signature") ?? "";

  // Always verify — reject if missing or invalid (was: `if (signature && ...` which allowed bypass)
  if (!verifySumUpSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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
        // Mark any abandoned booking as converted now that payment succeeded
        await prisma.abandonedBooking.updateMany({
          where: { email, convertedAt: null },
          data:  { convertedAt: new Date() },
        }).catch(() => {});
        await prisma.bookingSession.updateMany({
          where: { email, converted: false },
          data:  { converted: true },
        }).catch(() => {});

        // Dedup: skip if customer OR admin email already sent for this booking
        const alreadySent = await prisma.emailLog.findFirst({
          where: { bookingId: booking.id, type: { in: ["PAYMENT_CONFIRMATION", "ADMIN_BOOKING_ALERT"] } },
        }).catch(() => null);

        if (!alreadySent) {
          const transactionId = (data.transaction_id ?? checkoutId) as string;
          const route = updated.dropoffAddress
            ? `${updated.pickupAddress} → ${updated.dropoffAddress}`
            : updated.pickupAddress;

          // Await both emails — fire-and-forget kills on Vercel serverless
          const [custResult, adminResult] = await Promise.allSettled([
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
            }),
            sendAdminNewBookingAlert({
              confirmationCode: updated.confirmationCode,
              guestName:        updated.guestName ?? "Guest",
              guestEmail:       email,
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
            console.error("[resend] customer email (webhook):", custResult.reason);
          if (adminResult.status === "rejected")
            console.error("[resend] admin alert (webhook):", adminResult.reason);

          // WhatsApp — isolated so failure never breaks the webhook response
          if (updated.guestPhone) {
            try {
              await sendWhatsAppBookingConfirmation({
                phone:          updated.guestPhone,
                bookingRef:     updated.confirmationCode,
                pickupDatetime: updated.pickupDatetime.toLocaleString("en-GB"),
                route,
              });
            } catch (waErr) {
              console.error("[whatsapp] booking confirmation (webhook):", waErr);
            }
          }
        }
      }
    } else if (status === "FAILED" || status === "EXPIRED") {
      const failedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data:  { paymentStatus: "FAILED" },
      }).catch(() => null);

      if (failedBooking?.guestEmail) {
        try {
          await sendFailedPaymentEmail({
            to:               failedBooking.guestEmail,
            name:             failedBooking.guestName ?? "Valued Client",
            confirmationCode: failedBooking.confirmationCode,
            bookingId:        failedBooking.id,
          });
        } catch (e) {
          console.error("[resend] failed payment (webhook):", e);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
