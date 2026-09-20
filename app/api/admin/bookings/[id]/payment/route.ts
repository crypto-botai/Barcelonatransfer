import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPaymentConfirmationEmail } from "@/lib/resend";
import { formatPickupDateTime } from "@/lib/datetime";
import { PAYMENT_METHODS } from "@/lib/payment-method";

/**
 * The office marking a payment received — or not.
 *
 * Cash handed to the chauffeur, a Bizum arranged on WhatsApp, a bank
 * transfer that has landed: none of these pass through the checkout, so
 * someone has to say the money arrived. Who and when is recorded on the
 * booking, and the customer gets the same receipt a card payment sends.
 */
const schema = z.object({
  paymentStatus: z.enum(["PAID", "PENDING"]),
  paymentMethod: z.enum(PAYMENT_METHODS as [string, ...string[]]).optional(),
  /** Send the customer a receipt when marking paid. Default on. */
  sendReceipt:   z.boolean().default(true),
  /**
   * The balance on a deposit booking, received (or not). Independent of
   * paymentStatus, which describes the deposit. When present, nothing else
   * in the body is applied.
   */
  balancePaid:   z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const admin = session?.user as { id?: string; name?: string; role?: string } | undefined;
  if (!session || admin?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  const body = parsed.data;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.isDeleted) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (body.balancePaid !== undefined) {
    if (!booking.balanceAmount || booking.balanceAmount <= 0) return NextResponse.json({ error: "This booking has no balance" }, { status: 422 });
    const updated = await prisma.booking.update({
      where: { id },
      data: body.balancePaid
        ? { balancePaidAt: new Date(), balancePaidBy: admin.name ?? admin.id ?? "admin", balanceMethod: "OFFICE" }
        : { balancePaidAt: null, balancePaidBy: null, balanceMethod: null },
    });
    await prisma.activityLog.create({
      data: {
        adminId: admin.id ?? "admin", adminName: admin.name ?? "Admin",
        action: body.balancePaid ? "MARK_BALANCE_PAID" : "MARK_BALANCE_UNPAID", entity: "BOOKING", entityId: id,
        details: { confirmationCode: booking.confirmationCode, amount: booking.balanceAmount } as never,
      },
    }).catch(() => {});
    return NextResponse.json({ id: updated.id, balancePaidAt: updated.balancePaidAt, balancePaidBy: updated.balancePaidBy, balanceMethod: updated.balanceMethod });
  }

  const paid = body.paymentStatus === "PAID";
  const updated = await prisma.booking.update({
    where: { id },
    data: {
      paymentStatus: paid ? "PAID" : "PENDING",
      paymentMethod: (body.paymentMethod ?? booking.paymentMethod ?? undefined) as never,
      paidAt:        paid ? new Date() : null,
      paidMarkedBy:  paid ? (admin.name ?? admin.id ?? "admin") : null,
    },
  });

  await prisma.activityLog.create({
    data: {
      adminId:   admin.id ?? "admin",
      adminName: admin.name ?? "Admin",
      action:    paid ? "MARK_PAID" : "MARK_UNPAID",
      entity:    "BOOKING",
      entityId:  id,
      details:   { confirmationCode: booking.confirmationCode, method: updated.paymentMethod, amount: booking.totalAmount } as never,
    },
  }).catch(() => {});

  if (paid && body.sendReceipt && booking.guestEmail && booking.paymentStatus !== "PAID") {
    sendPaymentConfirmationEmail({
      to:               booking.guestEmail,
      name:             booking.guestName ?? "Valued Client",
      confirmationCode: booking.confirmationCode,
      pickupAddress:    booking.pickupAddress,
      dropoffAddress:   booking.dropoffAddress,
      pickupDatetime:   formatPickupDateTime(booking.pickupDatetime),
      vehicleClass:     booking.vehicleClass,
      totalAmount:      booking.totalAmount,
      passengers:       booking.passengers,
      bookingId:        booking.id,
    }).catch((e) => console.error("[resend] mark paid receipt:", e));
  }

  return NextResponse.json({
    id: updated.id,
    paymentStatus: updated.paymentStatus,
    paymentMethod: updated.paymentMethod,
    paidAt: updated.paidAt,
    paidMarkedBy: updated.paidMarkedBy,
  });
}
