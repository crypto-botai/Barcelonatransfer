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
import { notifyAdmin } from "@/lib/whatsapp";
import { sendFlightDelayEmail, sendDriverFlightDelayEmail, sendOpsFlightAlert } from "@/lib/resend";
import { lookupFlight, isMaterialDelay, isFlightTrackingEnabled } from "./index";
import { driverMailTo } from "@/lib/driver-email";

export interface SweepResult {
  enabled: boolean;
  checked: number;
  delayed: number;
  notified: number;
  unresolved: number;
}

/** Just the time, Barcelona clock — for a table where the date is said once. */
function clockText(d: Date | null): string | null {
  return d
    ? d.toLocaleString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" })
    : null;
}

/** "3h 27m" between two moments, or null when either end is unknown. */
function durationText(from: Date | null, to: Date | null): string | null {
  if (!from || !to) return null;
  const mins = Math.round((to.getTime() - from.getTime()) / 60000);
  if (!Number.isFinite(mins) || mins <= 0 || mins > 24 * 60) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
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

  /**
   * The alerts, held until the sweep is finished.
   *
   * Started and forgotten, they raced the cron's own response: this function
   * returns the moment the loop ends, the route returns straight after, and
   * the instance can be frozen with the sends still in flight. Collected here
   * and awaited at the bottom instead.
   */
  const pending: Promise<unknown>[] = [];

  const bookings = await prisma.booking.findMany({
    where: {
      pickupDatetime: { gte: new Date(), lte: new Date(Date.now() + hoursAhead * 3600_000) },
      status:         { in: ["CONFIRMED", "DRIVER_ASSIGNED"] },
      flightNumber:   { not: null },
    },
    select: {
      id: true, userId: true, guestPhone: true, guestName: true, flightNumber: true,
      pickupDatetime: true, confirmationCode: true, pickupAddress: true,
      // Both addresses are needed because notify()'s email channel only fires
      // when the caller supplies a sender, and a sender needs somewhere to send.
      guestEmail: true,
      // The company a job was dispatched to. It has to hear about a delay
      // before it has named a driver, or nobody on the job does.
      partner: { select: { userId: true, name: true, contactName: true, email: true, active: true } },
      // Needed to alert the driver, who has to physically be somewhere at a
      // different time than planned.
      driver: {
        select: {
          userId: true,
          whatsappNumber: true,
          // A fleet driver's post may go to their company's inbox instead.
          notifyEmail: true,
          user: { select: { name: true, phone: true, email: true } },
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
    //
    // Per recipient, not per booking. One shared check meant that once the
    // customer had been told, a driver assigned afterwards was never told at
    // all, which is exactly the driver who most needs to know.
    // Set when anyone was told something new this run. If nobody was, the office
    // is not told again either: an hourly sweep that re-announced a steady delay
    // to operations would be the same bug the customer emails had.
    let fresh = false;

    const announced = async (action: string, recipient?: string): Promise<boolean> => {
      const rows = await prisma.activityLog.findMany({
        where: { action, entity: "Notification", entityId: b.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }).catch(() => []);
      const row = rows.find((r) => {
        const d = r.details as { recipient?: string } | null;
        return recipient ? d?.recipient === recipient : !d?.recipient;
      });
      return (row?.details as { when?: string } | null)?.when === when;
    };

    // ── 1. The customer ──────────────────────────────────────────────────────
    // Reassurance: their driver already knows, nothing for them to do.
    if (!(await announced("NOTIFY_FLIGHT_DELAYED"))) {
      fresh = true;
      await notify({
        event:     "FLIGHT_DELAYED",
        userId:    b.userId,
        bookingId: b.id,
        phone:     b.guestPhone,
        // `when` lands in the audit details via notify(), which is what the
        // dedup check above reads on the next run.
        vars: { flight: status.flightNumber, when, code: b.confirmationCode },
        // notify() lists "email" among this event's channels but skips it unless
        // the caller hands it a sender, and none ever did.
        email: b.guestEmail && b.guestName
          ? () => sendFlightDelayEmail({
              to:               b.guestEmail!,
              name:             b.guestName!,
              flight:           status.flightNumber,
              when,
              confirmationCode: b.confirmationCode,
              delayMinutes:     status.delayMinutes,
            })
          : undefined,
      });
    }

    // ── 2. The assigned driver ───────────────────────────────────────────────
    // The customer's message promises "your driver has been updated". This is
    // what makes that true. Without it a driver waits at arrivals for a plane
    // that is ninety minutes away, or leaves before it lands.
    //
    // A fleet company's driver is a driver like any other: same in-app inbox,
    // same push, and the company's shared inbox when the company has set one.
    if (b.driver && !(await announced("NOTIFY_FLIGHT_DELAYED_DRIVER", b.driver.userId))) {
      fresh = true;
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
          recipient: b.driver.userId,
        },
        email: driverMailTo(b.driver)
          ? () => sendDriverFlightDelayEmail({
              to:               driverMailTo(b.driver!),
              driverName:       b.driver!.user.name ?? "there",
              flight:           status.flightNumber,
              when,
              confirmationCode: b.confirmationCode,
              passenger:        b.guestName ?? "Your passenger",
              pickupAddress:    b.pickupAddress,
              delayMinutes:     status.delayMinutes,
            })
          : undefined,
      });
    }

    // ── 2b. The fleet company, when it has not named a driver yet ────────────
    // A job dispatched to a company sits with no driver until the company picks
    // one. Until then nobody on the job would hear the flight has moved.
    if (!b.driver && b.partner?.active && !(await announced("NOTIFY_FLIGHT_DELAYED_DRIVER", b.partner.userId))) {
      fresh = true;
      await notify({
        event:     "FLIGHT_DELAYED_DRIVER",
        userId:    b.partner.userId,
        bookingId: b.id,
        vars: {
          flight:    status.flightNumber,
          when,
          code:      b.confirmationCode,
          passenger: b.guestName ?? "Your passenger",
          pickup:    b.pickupAddress,
          recipient: b.partner.userId,
        },
        email: b.partner.email
          ? () => sendDriverFlightDelayEmail({
              to:               b.partner!.email,
              driverName:       b.partner!.contactName || b.partner!.name,
              flight:           status.flightNumber,
              when,
              confirmationCode: b.confirmationCode,
              passenger:        b.guestName ?? "Your passenger",
              pickupAddress:    b.pickupAddress,
              delayMinutes:     status.delayMinutes,
            })
          : undefined,
      });
    }

    if (!fresh) continue;

    // ── 3. Operations ────────────────────────────────────────────────────────
    // A delay can collide with the driver's next job, which only a human can
    // re-plan. Fire-and-forget: an admin alert must never hold up telling the
    // customer and driver.
    // WhatsApp stays a single line, because that is what a phone alert is
    // for: enough to know whether to open the email standing next to it.
    pending.push(notifyAdmin(
      `Flight delay — booking ${b.confirmationCode.slice(0, 8).toUpperCase()}\n` +
      `${status.flightNumber} now lands ${when}` +
      (status.delayMinutes ? ` (${status.delayMinutes} min late)` : "") + `\n` +
      `Pickup: ${b.pickupAddress}\n` +
      `Driver: ${b.driver?.user.name ?? "NOT YET ASSIGNED"}`,
    ).catch(() => {}));

    // The email carries everything the provider told us, which is most of
    // what decides whether this delay needs a human: whether the aircraft has
    // even left, how late it left, and which terminal it comes into.
    pending.push(sendOpsFlightAlert({
      confirmationCode: b.confirmationCode,
      flightNumber:     status.flightNumber,
      airline:          status.airline,
      state:            status.state,
      delayMinutes:     status.delayMinutes,
      from: {
        code:      status.departureAirport,
        name:      status.departureAirportName,
        terminal:  status.departureTerminal,
        scheduled: clockText(status.scheduledDeparture),
        actual:    clockText(status.actualDeparture),
      },
      to: {
        code:      status.arrivalAirport,
        name:      status.arrivalAirportName,
        terminal:  status.arrivalTerminal,
        scheduled: clockText(status.scheduledArrival),
        estimated: clockText(status.estimatedArrival),
      },
      duration: durationText(
        status.actualDeparture ?? status.scheduledDeparture,
        status.estimatedArrival ?? status.scheduledArrival,
      ),
      pickupAddress: b.pickupAddress,
      passenger:     b.guestName,
      driver:        b.driver?.user.name ?? null,
      bookingId:     b.id,
    }).catch((e) => console.error("[flights] ops alert:", e)));
    result.notified++;
  }

  // Nothing started above may outlive the response.
  await Promise.allSettled(pending);

  return result;
}
