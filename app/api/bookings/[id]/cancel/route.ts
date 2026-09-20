import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundSumUpTransaction } from "@/lib/sumup";
import { sendCancellationEmail, sendAdminCancellationAlert } from "@/lib/resend";
import { formatPickupDateTime } from "@/lib/datetime";
import { refundPolicy, paidOnline, FREE_CANCEL_HOURS, PROTECTION_CUTOFF_HOURS } from "@/lib/deposits";

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

  // The policy, server-authoritative. Free up to 24 hours before pickup;
  // with cancellation protection, up to 2 hours before, the fee itself kept.
  // See lib/deposits.ts.
  const paid = paidOnline(booking);
  const decision = refundPolicy({ pickupDatetime: booking.pickupDatetime, paidAmount: paid, protectionFee: booking.protectionFee });
  if (!decision.allowed) {
    return NextResponse.json({
      error: decision.rule === "inside-2h"
        ? `Cancellation protection covers cancellations up to ${PROTECTION_CUTOFF_HOURS} hours before pickup. For assistance, contact us via WhatsApp.`
        : `Free cancellation requires more than ${FREE_CANCEL_HOURS} hours notice. For assistance, contact us via WhatsApp.`,
      policy: "NO_REFUND",
      whatsappUrl: "https://wa.me/34635383712",
    }, { status: 422 });
  }

  // Process the SumUp refund if already paid. On a protected booking the
  // protection fee stays with us and the rest comes back; on a deposit
  // booking it is the deposit (less the fee) that is refunded, since that is
  // all that was ever charged.
  let refundProcessed = false;
  let refundError: string | undefined;
  const refundAmount = decision.refund;

  if (booking.paymentStatus === "PAID" && booking.stripePaymentId && refundAmount > 0) {
    try {
      await refundSumUpTransaction(booking.stripePaymentId, refundAmount);
      refundProcessed = true;
    } catch (err) {
      refundError = err instanceof Error ? err.message : String(err);
      console.error("[cancel] SumUp refund failed:", refundError);
    }
  }

  const partial = refundProcessed && decision.kept > 0;
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status:        refundProcessed ? "REFUNDED" : "CANCELLED",
      paymentStatus: refundProcessed ? (partial ? "PARTIALLY_REFUNDED" : "REFUNDED") : booking.paymentStatus,
    },
  });

  await prisma.activityLog.create({
    data: {
      adminId: user.id, adminName: booking.guestName ?? "Customer",
      action: "CANCEL_BOOKING", entity: "BOOKING", entityId: booking.id,
      details: { rule: decision.rule, paid, refund: refundAmount, kept: decision.kept, refundProcessed, refundError: refundError ?? null } as never,
    },
  }).catch(() => {});

  const customerEmail = booking.guestEmail ?? (session.user as { email?: string }).email;
  if (customerEmail) {
    const name = booking.guestName ?? "Valued Client";
    await Promise.allSettled([
      sendCancellationEmail({
        to:               customerEmail,
        name,
        confirmationCode: booking.confirmationCode,
        refundProcessed,
        totalAmount:      refundProcessed ? refundAmount : booking.totalAmount,
      }),
      sendAdminCancellationAlert({
        confirmationCode: booking.confirmationCode,
        guestName:        name,
        guestEmail:       customerEmail,
        totalAmount:      refundProcessed ? refundAmount : booking.totalAmount,
        refundProcessed,
        pickupDatetime:   formatPickupDateTime(booking.pickupDatetime),
        pickupAddress:    booking.pickupAddress,
      }),
    ]);
  }

  return NextResponse.json({
    success:        true,
    status:         updated.status,
    refundProcessed,
    refundAmount:   refundProcessed ? refundAmount : 0,
    keptAmount:     decision.kept,
    refundError,
    message: refundProcessed
      ? decision.kept > 0
        ? `Booking cancelled. €${refundAmount.toFixed(2)} is on its way back to your card; the €${decision.kept.toFixed(2)} protection fee is not refundable. Allow 3–5 business days.`
        : "Booking cancelled and refund initiated. Allow 3–5 business days."
      : booking.paymentStatus === "PAID"
        ? "Booking cancelled. Please contact us if you need refund assistance."
        : "Booking cancelled successfully.",
  });
}
