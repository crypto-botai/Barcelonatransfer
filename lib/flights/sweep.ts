/**
 * Proactive delay sweep.
 *
 * Checks upcoming bookings that carry a flight number and notifies the customer
 * when the arrival time has moved materially.
 *
 * Runs inside the daily pickup-reminder cron rather than as its own Vercel cron
 * entry. Two reasons: the Hobby plan caps crons at one run per day, so a
 * dedicated entry would buy no extra freshness; and an invalid cron schedule
 * has previously caused every deployment on this project to be rejected
 * silently. The live-freshness case is served by /api/flights/status, which the
 * driver and customer views call on demand.
 */

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications/service";
import { lookupFlight, isMaterialDelay, isFlightTrackingEnabled } from "./index";

export interface SweepResult {
  enabled: boolean;
  checked: number;
  delayed: number;
  notified: number;
  unresolved: number;
}

/** Formats a Date for customer-facing copy in the local Barcelona convention. */
function whenText(d: Date): string {
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/Madrid",
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export async function sweepFlightDelays(hoursAhead = 36): Promise<SweepResult> {
  const result: SweepResult = { enabled: false, checked: 0, delayed: 0, notified: 0, unresolved: 0 };

  if (!isFlightTrackingEnabled()) return result;
  result.enabled = true;

  const bookings = await prisma.booking.findMany({
    where: {
      pickupDatetime: { gte: new Date(), lte: new Date(Date.now() + hoursAhead * 3600_000) },
      status:         { in: ["CONFIRMED", "DRIVER_ASSIGNED"] },
      flightNumber:   { not: null },
    },
    select: {
      id: true, userId: true, guestPhone: true, flightNumber: true,
      pickupDatetime: true, confirmationCode: true,
    },
  });

  for (const b of bookings) {
    if (!b.flightNumber) continue;
    result.checked++;

    const outcome = await lookupFlight(b.flightNumber, b.pickupDatetime);
    if (!outcome.ok) {
      // Unknown is not a delay. Say nothing rather than guess.
      result.unresolved++;
      continue;
    }

    const status = outcome.status;
    if (!isMaterialDelay(status)) continue;
    result.delayed++;

    const arrival = status.estimatedArrival ?? status.scheduledArrival;
    if (!arrival) {
      // Flagged as delayed but with no usable time to quote. Telling the
      // customer "delayed until <blank>" is worse than staying quiet; the
      // on-demand endpoint will still show them the live state.
      result.unresolved++;
      continue;
    }

    const when = whenText(arrival);

    // Dedup on the audit trail the notification service already writes, so a
    // delay that holds steady across runs is announced once. A further slip
    // produces a different `when` and does notify again, which is correct.
    const already = await prisma.activityLog.findFirst({
      where: {
        action:   "NOTIFY_FLIGHT_DELAYED",
        entity:   "Notification",
        entityId: b.id,
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => null);

    const previousWhen = (already?.details as { when?: string } | null)?.when;
    if (previousWhen === when) continue;

    await notify({
      event:     "FLIGHT_DELAYED",
      userId:    b.userId,
      bookingId: b.id,
      phone:     b.guestPhone,
      // `when` lands in the audit details via notify(), which is what the
      // dedup check above reads on the next run.
      vars: { flight: status.flightNumber, when, code: b.confirmationCode },
    });
    result.notified++;
  }

  return result;
}
