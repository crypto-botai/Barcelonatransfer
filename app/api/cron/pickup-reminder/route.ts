import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPickupReminder } from "@/lib/resend";
import { arrivalUrl } from "@/lib/arrival-token";

// Reminders plus the flight-delay sweep, which calls an external API per flight.
export const maxDuration = 180;

/**
 * The arrival link, or nothing if it cannot be signed.
 *
 * An unset NEXTAUTH_SECRET makes signing throw. That must not take down the
 * whole reminder run — the reminder itself is far more important than the link
 * inside it, so a failure here simply omits the section.
 */
function safeArrivalUrl(bookingId: string): string | null {
  try {
    return arrivalUrl(bookingId);
  } catch {
    return null;
  }
}
import { notify } from "@/lib/notifications/service";
import { sweepFlightDelays } from "@/lib/flights/sweep";
import { reconcilePendingPayments } from "@/lib/payments/reconcile";
import { formatPickupDateTime } from "@/lib/datetime";
import { BASE_URL } from "@/lib/seo";

const CRON_SECRET = process.env.CRON_SECRET ?? "elite-cron-secret";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  /**
   * One reminder, between 6 and 12 hours before the car is wanted.
   *
   * The window used to run to 36 hours, which was right when this was a daily
   * job and wrong once it went hourly: a booking sat inside it for thirty
   * hours and was seen on all thirty runs. The EmailLog check below was meant
   * to make that harmless, and did not, because the row it looks for was
   * written without a bookingId. Customers were reminded on the hour, every
   * hour, through the night. See lib/resend.ts sendPickupReminder.
   *
   * Six hours is the floor because a reminder that lands after someone has
   * left for the airport is no use. Twelve is the ceiling because the evening
   * before is when it is read. An hourly cron sees each booking about six
   * times inside that, and sends on the first.
   */
  const from = new Date(Date.now() + 6  * 60 * 60 * 1000);
  const to   = new Date(Date.now() + 12 * 60 * 60 * 1000);

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
        pickupDatetime:  formatPickupDateTime(b.pickupDatetime),
        vehicleClass:    b.vehicleClass,
        // Only airport pick-ups get the arrival link: it exists to cover the
        // walk from the aircraft to the car, and on a hotel pickup there is no
        // such walk to report.
        arrivalUrl:      b.flightNumber ? safeArrivalUrl(b.id) : null,
        // What the dedup above reads. Without it the log row is written with a
        // null bookingId, the lookup never matches, and this sends again.
        bookingId:       b.id,
      });
      sent++;

      // Same reminder to the portal and WhatsApp. Email is excluded from the
      // channel list because sendPickupReminder above already covers it — and
      // it is what writes the EmailLog row this loop dedups on.
      await notify({
        event:     "PICKUP_REMINDER",
        // The text goes with the email and under the same once-only guard: this
        // block only runs after sendPickupReminder has written its EmailLog row,
        // so a customer is texted once per booking, not once per hourly run.
        channels:  ["inapp", "whatsapp", "sms"],
        userId:    b.userId,
        bookingId: b.id,
        phone:     b.guestPhone,
        vars: {
          code:  b.confirmationCode,
          when:  formatPickupDateTime(b.pickupDatetime),
          route: b.dropoffAddress ? `${b.pickupAddress} → ${b.dropoffAddress}` : b.pickupAddress,
          link:  `${BASE_URL}/track/${b.confirmationCode}`,
        },
      });
    } catch (err) {
      console.error("[cron/pickup-reminder]", err);
    }
  }

  // Same pass, same 36h horizon: check whether any of tomorrow's flights have
  // slipped and tell the affected customers. This cron runs hourly, so a delay
  // announced in the evening reaches the customer that evening rather than the
  // next morning. It stays here rather than in a cron of its own because the
  // two jobs look at the same set of upcoming pickups.
  const flights = await sweepFlightDelays(36).catch((err) => {
    console.error("[cron/pickup-reminder] flight sweep:", err);
    return null;
  });

  // Payment reconciliation also runs on its own schedule, every 15 minutes.
  // This call is the belt to that braces: harmless when there is nothing to
  // reconcile, and it keeps working if the dedicated entry is ever removed.
  const payments = await reconcilePendingPayments().catch(() => null);

  return NextResponse.json({ ok: true, sent, flights, payments });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
