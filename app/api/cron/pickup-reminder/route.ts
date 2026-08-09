import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPickupReminder } from "@/lib/resend";
import { notify } from "@/lib/notifications/service";
import { sweepFlightDelays } from "@/lib/flights/sweep";
import { reconcilePendingPayments } from "@/lib/payments/reconcile";

const CRON_SECRET = process.env.CRON_SECRET ?? "elite-cron-secret";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // This cron now runs once daily (Vercel Hobby plan caps crons at once/day), so the window
  // must be at least as wide as the 24h gap between runs, or bookings whose pickup time falls
  // outside a narrow band would never be checked on any run and would silently get no reminder.
  // 6h-36h gives every booking two overlapping chances to be caught, with margin for cron jitter.
  const from = new Date(Date.now() + 6  * 60 * 60 * 1000);
  const to   = new Date(Date.now() + 36 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      pickupDatetime: { gte: from, lte: to },
      status:         { in: ["CONFIRMED", "DRIVER_ASSIGNED"] },
      guestEmail:     { not: null },
    },
  });

  let sent = 0;
  for (const b of bookings) {
    if (!b.guestEmail || !b.guestName) continue;

    // Check not already sent (check email logs)
    const alreadySent = await prisma.emailLog.findFirst({
      where: { to: b.guestEmail, type: "REMINDER", bookingId: b.id },
    });
    if (alreadySent) continue;

    try {
      await sendPickupReminder({
        to:              b.guestEmail,
        name:            b.guestName,
        confirmationCode: b.confirmationCode,
        pickupAddress:   b.pickupAddress,
        pickupDatetime:  new Date(b.pickupDatetime).toLocaleString("en-GB"),
        vehicleClass:    b.vehicleClass,
      });
      sent++;

      // Same reminder to the portal and WhatsApp. Email is excluded from the
      // channel list because sendPickupReminder above already covers it — and
      // it is what writes the EmailLog row this loop dedups on.
      await notify({
        event:     "PICKUP_REMINDER",
        channels:  ["inapp", "whatsapp"],
        userId:    b.userId,
        bookingId: b.id,
        phone:     b.guestPhone,
        vars: {
          code:  b.confirmationCode,
          when:  new Date(b.pickupDatetime).toLocaleString("en-GB"),
          route: b.dropoffAddress ? `${b.pickupAddress} → ${b.dropoffAddress}` : b.pickupAddress,
        },
      });
    } catch (err) {
      console.error("[cron/pickup-reminder]", err);
    }
  }

  // Same daily pass, same 36h horizon: check whether any of tomorrow's flights
  // have slipped and tell the affected customers. Kept inside this cron because
  // the Hobby plan allows one run per day per entry, so a separate cron would
  // add deployment risk without adding freshness.
  const flights = await sweepFlightDelays(36).catch((err) => {
    console.error("[cron/pickup-reminder] flight sweep:", err);
    return null;
  });

  // Payment reconciliation piggybacks here: the Hobby plan allows one run
  // per cron entry per day, so spreading it across the existing jobs is the
  // only way to catch a failed payment before the next morning.
  const payments = await reconcilePendingPayments().catch(() => null);

  return NextResponse.json({ ok: true, sent, flights, payments });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
