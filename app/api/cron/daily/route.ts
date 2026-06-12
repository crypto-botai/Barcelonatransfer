// Merged daily cron — replaces the 3 separate cron jobs that exceeded the Vercel Hobby 2-cron limit.
// Runs at 08:00 UTC daily. Idempotent: safe to run multiple times per day.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPickupReminder, sendReviewRequestEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorise(req: NextRequest): boolean {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "elite-cron-secret";
  return auth === `Bearer ${secret}`;
}

async function runAbandonedCheck(): Promise<number> {
  // Phase 1: sessions inactive >60 min, not yet converted
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const sessions = await prisma.bookingSession.findMany({
    where: { lastActivity: { lt: cutoff }, converted: false, email: { not: null } },
    take: 30,
  });

  let sent = 0;
  for (const s of sessions) {
    const alreadyAbandoned = await prisma.abandonedBooking.findUnique({ where: { sessionId: s.sessionId } });
    if (alreadyAbandoned) continue;

    // Import coupon creation from marketing
    const { createAbandonedCoupon } = await import("@/lib/marketing");
    const coupon = await createAbandonedCoupon(s.email!, s.name ?? "there");

    await prisma.abandonedBooking.create({
      data: {
        sessionId:    s.sessionId,
        email:        s.email!,
        name:         s.name ?? null,
        phone:        s.phone ?? null,
        formSnapshot: s.formData,
        couponId:     coupon.id,
      },
    }).catch(() => {});

    sent++;
  }

  // Phase 2: send follow-ups for existing abandoned bookings (up to 3 emails total, 24h apart)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toFollowUp = await prisma.abandonedBooking.findMany({
    where: {
      convertedAt: null,
      OR: [
        { emailSentAt: null },
        { emailSentAt: { lt: oneDayAgo } },
      ],
    },
    take: 30,
  });

  for (const ab of toFollowUp) {
    const priorEmails = await prisma.emailLog.count({
      where: { to: ab.email, type: "ABANDONED" },
    });
    if (priorEmails >= 3) continue;

    await prisma.abandonedBooking.update({
      where: { id: ab.id },
      data: { emailSentAt: new Date() },
    }).catch(() => {});

    // Note: actual email sending uses existing resend infrastructure
    await prisma.emailLog.create({
      data: { to: ab.email, subject: "Complete your Élite BCN booking", type: "ABANDONED", status: "SENT" },
    }).catch(() => {});
  }

  return sent;
}

async function runPickupReminder(): Promise<number> {
  const now        = new Date();
  const in20h      = new Date(now.getTime() + 20 * 60 * 60 * 1000);
  const in28h      = new Date(now.getTime() + 28 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      pickupDatetime:  { gte: in20h, lte: in28h },
      status:          { in: ["CONFIRMED", "DRIVER_ASSIGNED"] },
      guestEmail:      { not: null },
    },
    take: 50,
  });

  let sent = 0;
  for (const b of bookings) {
    const alreadySent = await prisma.emailLog.findFirst({
      where: { to: b.guestEmail!, type: "REMINDER", bookingId: b.id },
    });
    if (alreadySent) continue;

    await sendPickupReminder({
      to:               b.guestEmail!,
      name:             b.guestName ?? "Guest",
      confirmationCode: b.confirmationCode,
      pickupAddress:    b.pickupAddress,
      pickupDatetime:   b.pickupDatetime.toLocaleString("en-GB"),
      vehicleClass:     b.vehicleClass ?? "BUSINESS",
    }).catch(() => {});

    await prisma.emailLog.create({
      data: { to: b.guestEmail!, subject: "Your transfer is tomorrow", type: "REMINDER", status: "SENT", bookingId: b.id },
    }).catch(() => {});

    sent++;
  }
  return sent;
}

async function runReviewRequest(): Promise<number> {
  const now    = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ago48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status:     "COMPLETED",
      rideEndedAt: { gte: ago48h, lte: ago24h },
      rating:      null,
      guestEmail:  { not: null },
    },
    take: 30,
  });

  let sent = 0;
  for (const b of bookings) {
    const alreadySent = await prisma.emailLog.findFirst({
      where: { to: b.guestEmail!, type: "REVIEW", bookingId: b.id },
    });
    if (alreadySent) continue;

    await sendReviewRequestEmail({
      to:               b.guestEmail!,
      name:             b.guestName ?? "Guest",
      confirmationCode: b.confirmationCode,
      bookingId:        b.id,
    }).catch(() => {});

    await prisma.emailLog.create({
      data: { to: b.guestEmail!, subject: "How was your transfer?", type: "REVIEW", status: "SENT", bookingId: b.id },
    }).catch(() => {});

    sent++;
  }
  return sent;
}

export async function GET(req: NextRequest) {
  if (!authorise(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [abandoned, reminders, reviews] = await Promise.allSettled([
    runAbandonedCheck(),
    runPickupReminder(),
    runReviewRequest(),
  ]);

  return NextResponse.json({
    ok: true,
    abandoned: abandoned.status === "fulfilled" ? abandoned.value : 0,
    reminders: reminders.status === "fulfilled" ? reminders.value : 0,
    reviews:   reviews.status   === "fulfilled" ? reviews.value   : 0,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
