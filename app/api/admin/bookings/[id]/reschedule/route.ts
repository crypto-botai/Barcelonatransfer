import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pickupToUtc, formatPickupDateTime } from "@/lib/datetime";
import { repriceForNewTime, applyToBalance } from "@/lib/reschedule-price";
import { sendBookingRescheduledEmail } from "@/lib/resend";

/**
 * Moving a booking to a different date or time.
 *
 * Only the office can do this. A customer who needs a different time is told
 * to call, because a flight that moves usually moves the pick-up address and
 * the vehicle too, and because the fare depends on when the car is wanted:
 * a night pick-up carries 20% and a last-minute one 15%.
 *
 * So the new price is worked out and returned before anything is written.
 * The office sees what the move costs, decides, and sends it back with
 * `confirm: true`. Nothing is charged automatically — the difference lands
 * on the balance the chauffeur collects, which is where an office that has
 * just agreed a change on the phone would put it.
 */

const schema = z.object({
  /** "YYYY-MM-DD" in Barcelona. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  /** "HH:mm" on a 24-hour clock, in Barcelona. */
  time: z.string().regex(/^\d{1,2}:\d{2}$/, "Time must be HH:mm"),
  /**
   * False (the default) prices the move and changes nothing, so the office
   * can see the difference first. True applies it.
   */
  confirm: z.boolean().default(false),
  /**
   * Whether to apply the price difference. The office may waive it — a
   * delayed flight is not the customer's doing.
   */
  applyPriceChange: z.boolean().default(true),
  /** Tell the customer. Default on. */
  notifyCustomer: z.boolean().default(true),
});

const CLOSED = ["CANCELLED", "REFUNDED", "COMPLETED"];

/** Same check the rest of the admin booking routes make. */
async function requireAdmin() {
  const s = await getServerSession(authOptions);
  if (!s) return null;
  const u = s.user as { role?: string; id?: string; name?: string };
  if (u.role !== "ADMIN") return null;
  return u;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const raw = await req.json().catch(() => null);
  if (raw === null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(raw);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.errors[0].message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const newPickup = pickupToUtc(body.date, body.time);
  if (!newPickup) {
    return NextResponse.json({ error: "That is not a real date and time." }, { status: 422 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true, confirmationCode: true, status: true,
      pickupDatetime: true, pickupAddress: true,
      baseFare: true, totalAmount: true,
      depositAmount: true, balanceAmount: true, balancePaidAt: true,
      guestName: true, guestEmail: true,
      user: { select: { name: true, email: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (CLOSED.includes(booking.status)) {
    return NextResponse.json(
      { error: `A ${booking.status.toLowerCase()} booking cannot be moved.` },
      { status: 409 },
    );
  }

  const priced = repriceForNewTime(
    {
      // A booking made before the fare was broken out can have a null base.
      // Falling back to the total means no surcharge is double-counted; it
      // only makes the uplift on a move slightly generous, which is the safe
      // direction for the customer.
      baseFare: booking.baseFare ?? booking.totalAmount,
      totalAmount: booking.totalAmount,
      pickupDatetime: booking.pickupDatetime,
    },
    newPickup,
  );

  const willApplyPrice = body.applyPriceChange && priced.difference !== 0;
  const balance = willApplyPrice
    ? applyToBalance(booking, priced.difference)
    : { balanceAmount: booking.balanceAmount, refundDue: 0 };

  const quote = {
    bookingId: booking.id,
    confirmationCode: booking.confirmationCode,
    from: formatPickupDateTime(booking.pickupDatetime),
    to:   formatPickupDateTime(newPickup),
    oldTotal:   priced.oldTotal,
    newTotal:   willApplyPrice ? priced.newTotal : priced.oldTotal,
    difference: willApplyPrice ? priced.difference : 0,
    nightSurcharge:      priced.newSurcharges.night,
    lastMinuteSurcharge: priced.newSurcharges.lastMinute,
    balanceAmount: balance.balanceAmount,
    refundDue:     balance.refundDue,
  };

  // A dry run: show the office what the move costs, write nothing.
  if (!body.confirm) {
    return NextResponse.json({ ok: true, preview: true, ...quote });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      pickupDatetime: newPickup,
      ...(willApplyPrice ? { totalAmount: priced.newTotal } : {}),
      // Only a booking that still has an uncollected balance moves it. One
      // already settled is left alone: the money is in, and rewriting the
      // figure would misreport what the chauffeur actually took.
      ...(willApplyPrice && booking.balanceAmount != null && booking.balancePaidAt == null
        ? { balanceAmount: balance.balanceAmount }
        : {}),
    },
    select: { id: true, pickupDatetime: true, totalAmount: true, balanceAmount: true },
  });

  const customerEmail = booking.guestEmail ?? booking.user?.email ?? null;
  if (body.notifyCustomer && customerEmail) {
    // Never let a mail problem undo a change the office has made.
    await sendBookingRescheduledEmail({
      to: customerEmail,
      name: booking.guestName ?? booking.user?.name ?? "Valued Client",
      confirmationCode: booking.confirmationCode,
      oldPickupDatetime: quote.from,
      newPickupDatetime: quote.to,
      pickupAddress: booking.pickupAddress,
      oldTotal: willApplyPrice ? priced.oldTotal : null,
      newTotal: willApplyPrice ? priced.newTotal : null,
      balanceDue: updated.balanceAmount,
    }).catch((err) => console.error("[reschedule] customer email failed", err));
  }

  return NextResponse.json({
    ok: true,
    preview: false,
    ...quote,
    pickupDatetime: updated.pickupDatetime,
    totalAmount:    updated.totalAmount,
    notified:       body.notifyCustomer && !!customerEmail,
  });
}
