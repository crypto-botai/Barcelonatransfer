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
import { notifyAdminWhatsApp } from "@/lib/whatsapp";
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
      id: true, userId: true, guestPhone: true, guestName: true, flightNumber: true,
      pickupDatetime: true, confirmationCode: true, pickupAddress: true,
      // Needed to alert the driver, who has to physically be somewhere at a
      // different time than planned.
      driver: {
        select: {
          userId: true,
          whatsappNumber: true,
          user: { select: { name: true, phone: true } },
        },
      },
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

    // ── 1. The customer ──────────────────────────────────────────────────────
    // Reassurance: their driver already knows, nothing for them to do.
    await notify({
      event:     "FLIGHT_DELAYED",
      userId:    b.userId,
      bookingId: b.id,
      phone:     b.guestPhone,
      // `when` lands in the audit details via notify(), which is what the
      // dedup check above reads on the next run.
      vars: { flight: status.flightNumber, when, code: b.confirmationCode },
    });

    // ── 2. The assigned driver ───────────────────────────────────────────────
    // The customer's message promises "your driver has been updated". This is
    // what makes that true. Without it a driver waits at arrivals for a plane
    // that is ninety minutes away, or leaves before it lands.
    if (b.driver) {
      await notify({
        event:     "FLIGHT_DELAYED_DRIVER",
        userId:    b.driver.userId,
        bookingId: b.id,
        phone:     b.driver.whatsappNumber ?? b.driver.user.phone,
        vars: {
          flight:    status.flightNumber,
          when,
          code:      b.confirmationCode,
          passenger: b.guestName ?? "Your passenger",
          pickup:    b.pickupAddress,
        },
      });
    }

    // ── 3. Operations ────────────────────────────────────────────────────────
    // A delay can collide with the driver's next job, which only a human can
    // re-plan. Fire-and-forget: an admin alert must never hold up telling the
    // customer and driver.
    void notifyAdminWhatsApp(
      `Flight delay — booking ${b.confirmationCode.slice(0, 8).toUpperCase()}\n` +
      `${status.flightNumber} now lands ${when}` +
      (status.delayMinutes ? ` (${status.delayMinutes} min late)` : "") + `\n` +
      `Pickup: ${b.pickupAddress}\n` +
      `Driver: ${b.driver?.user.name ?? "NOT YET ASSIGNED"}`,
    ).catch(() => {});
    result.notified++;
  }

  return result;
}
