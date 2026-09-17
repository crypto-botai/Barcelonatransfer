import { prisma } from "@/lib/prisma";
import { sendAbandonedBookingEmail } from "@/lib/resend";
import { vehicleClassLabel } from "@/types";

/**
 * Bringing back the people who nearly booked.
 *
 * Two kinds of near-miss, one treatment:
 *   - a form session with a name and an email that went quiet, and
 *   - a booking created on the website and never paid.
 * Fifteen minutes after they go quiet they get one recovery email. Once,
 * ever, per session or booking: the AbandonedBooking row (sessions) and an
 * EmailLog row (bookings) are the record that it went.
 *
 * WHY IT RUNS ON TRAFFIC. Vercel's Hobby plan runs each cron once a day, so
 * a cron alone would mean "within a day", not "within a quarter of an hour".
 * The sweep is cheap, so the booking form's own requests trigger it in the
 * background, throttled to once every few minutes per server instance. The
 * daily cron is the backstop for a quiet night. Idempotence is what makes
 * that safe: two instances sweeping at once cannot both email the same
 * person, because each checks the record before sending and the send
 * itself is what writes the record.
 */

export const ABANDON_AFTER_MS = 15 * 60_000;
const THROTTLE_MS = 3 * 60_000;

let lastSweepAt = 0;
let sweeping: Promise<SweepResult> | null = null;

export interface SweepResult { sessionsEmailed: number; bookingsEmailed: number; skipped: number }

/** Run the sweep if one has not run recently on this instance. */
export async function sweepAbandonedIfDue(): Promise<SweepResult | null> {
  if (Date.now() - lastSweepAt < THROTTLE_MS) return null;
  if (sweeping) return sweeping;
  lastSweepAt = Date.now();
  sweeping = sweepAbandoned().finally(() => { sweeping = null; });
  return sweeping;
}

export async function sweepAbandoned(): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS);
  const floor  = new Date(Date.now() - 14 * 86_400_000); // nothing older than two weeks
  const out: SweepResult = { sessionsEmailed: 0, bookingsEmailed: 0, skipped: 0 };

  // ── Sessions ──────────────────────────────────────────────
  const sessions = await prisma.bookingSession.findMany({
    where: {
      email: { not: null }, name: { not: null },
      converted: false,
      lastActivity: { lt: cutoff, gt: floor },
      abandonedBooking: null,
    },
    take: 25,
    orderBy: { lastActivity: "asc" },
  });

  for (const s of sessions) {
    try {
      // The row is the claim. A unique sessionId means a second sweeper
      // creating it concurrently fails here and sends nothing.
      // No discount code: the owner wants people brought back on service and
      // the price they already saw, not on a percentage off.
      const ab = await prisma.abandonedBooking.create({
        data: {
          sessionId: s.sessionId, email: s.email!, name: s.name, phone: s.phone,
          formSnapshot: (s.formData ?? {}) as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
      const fd = (s.formData ?? {}) as Record<string, unknown>;
      if (!fd.pickupAddress) { out.skipped++; continue; } // a name and nothing else is not a booking to recover
      // The details step asks, in so many words, whether Elite BCN may write
      // once about this journey if they do not finish. That box is the lawful
      // basis for the email; unticked, the lead is filed but not written to.
      // (An unpaid booking is different: they booked, so the office may write
      // about it.)
      if (fd.contactConsent !== true) { out.skipped++; continue; }
      await sendAbandonedBookingEmail({ to: s.email!, name: s.name!, formData: fd });
      await prisma.abandonedBooking.update({ where: { id: ab.id }, data: { emailSentAt: new Date() } });
      out.sessionsEmailed++;
    } catch (e) {
      out.skipped++;
      console.error("[abandoned] session", s.sessionId, e instanceof Error ? e.message : e);
    }
  }

  // ── Unpaid website bookings ───────────────────────────────
  const bookings = await prisma.booking.findMany({
    where: {
      isDeleted: false,
      status: "PENDING", paymentStatus: "PENDING",
      paymentMethod: null,               // made on the website, not by the office
      guestEmail: { not: null },
      createdAt: { lt: cutoff, gt: floor },
      pickupDatetime: { gt: new Date() }, // no point chasing a journey already in the past
    },
    take: 25,
    orderBy: { createdAt: "asc" },
    select: {
      id: true, guestEmail: true, guestName: true, pickupAddress: true, dropoffAddress: true,
      pickupDatetime: true, passengers: true, vehicleClass: true, totalAmount: true, stripeSessionId: true,
      pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true,
    },
  });

  for (const b of bookings) {
    try {
      const already = await prisma.emailLog.count({ where: { bookingId: b.id, type: "ABANDONED" } });
      if (already > 0) continue;
      await sendAbandonedBookingEmail({
        to: b.guestEmail!, name: b.guestName ?? "there",
        bookingId: b.id,
        formData: bookingAsForm(b),
        payUrl: b.stripeSessionId ? `/booking/pay/${b.stripeSessionId}?booking_id=${b.id}` : undefined,
      });
      out.bookingsEmailed++;
    } catch (e) {
      out.skipped++;
      console.error("[abandoned] booking", b.id, e instanceof Error ? e.message : e);
    }
  }

  return out;
}

/** The shape the recovery email reads, built from a booking row. */
export function bookingAsForm(b: {
  pickupAddress: string; dropoffAddress: string; pickupDatetime: Date;
  passengers: number; vehicleClass: string; totalAmount: number;
  pickupLat?: number; pickupLng?: number; dropoffLat?: number; dropoffLng?: number;
}): Record<string, unknown> {
  const d = b.pickupDatetime;
  const madrid = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => madrid.find((p) => p.type === t)?.value ?? "";
  return {
    pickupAddress: b.pickupAddress, dropoffAddress: b.dropoffAddress,
    date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}`,
    passengers: b.passengers, vehicleClass: b.vehicleClass, vehicleLabel: vehicleClassLabel(b.vehicleClass as never),
    totalAmount: b.totalAmount,
    pickupLat: b.pickupLat, pickupLng: b.pickupLng, dropoffLat: b.dropoffLat, dropoffLng: b.dropoffLng,
  };
}
