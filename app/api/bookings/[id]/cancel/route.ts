import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundSumUpTransaction } from "@/lib/sumup";
import { sendCancellationEmail, sendAdminCancellationAlert } from "@/lib/resend";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; email?: string };
  const { id } = await params;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify ownership
  if (booking.userId !== user.id && booking.guestEmail !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (booking.status === "CANCELLED" || booking.status === "REFUNDED") {
    return NextResponse.json({ error: "Booking is already cancelled" }, { status: 409 });
  }

  // 24-hour policy check (server-authoritative)
  const hoursUntilPickup = (booking.pickupDatetime.getTime() - Date.now()) / 3_600_000;
  if (hoursUntilPickup < 24) {
    return NextResponse.json({
      error: "Free cancellation requires more than 24 hours notice. For assistance, contact us via WhatsApp.",
      policy: "NO_REFUND",
      whatsappUrl: "https://wa.me/34635383712",
    }, { status: 422 });
  }

  // Process SumUp refund if already paid
  let refundProcessed = false;
  let refundError: string | undefined;

  if (booking.paymentStatus === "PAID" && booking.stripePaymentId) {
    try {
      await refundSumUpTransaction(booking.stripePaymentId, booking.totalAmount);
      refundProcessed = true;
    } catch (err) {
      refundError = err instanceof Error ? err.message : String(err);
      console.error("[cancel] SumUp refund failed:", refundError);
    }
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status:        refundProcessed ? "REFUNDED" : "CANCELLED",
      paymentStatus: refundProcessed ? "REFUNDED" : booking.paymentStatus,
    },
  });

  const customerEmail = booking.guestEmail ?? (session.user as { email?: string }).email;
  if (customerEmail) {
    const name = booking.guestName ?? "Valued Client";
    Promise.allSettled([
      sendCancellationEmail({
        to:               customerEmail,
        name,
        confirmationCode: booking.confirmationCode,
        refundProcessed,
        totalAmount:      booking.totalAmount,
      }),
      sendAdminCancellationAlert({
        confirmationCode: booking.confirmationCode,
        guestName:        name,
        guestEmail:       customerEmail,
        totalAmount:      booking.totalAmount,
        refundProcessed,
        pickupDatetime:   booking.pickupDatetime.toLocaleString("en-GB"),
        pickupAddress:    booking.pickupAddress,
      }),
    ]).catch(() => {});
  }

  return NextResponse.json({
    success:        true,
    status:         updated.status,
    refundProcessed,
    refundError,
    message: refundProcessed
      ? "Booking cancelled and refund initiated. Allow 3–5 business days."
      : booking.paymentStatus === "PAID"
        ? "Booking cancelled. Please contact us if you need refund assistance."
        : "Booking cancelled successfully.",
  });
}
