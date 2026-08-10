import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReviewRequestEmail } from "@/lib/resend";
import { notify } from "@/lib/notifications/service";
import { sweepFlightDelays } from "@/lib/flights/sweep";

const CRON_SECRET = process.env.CRON_SECRET ?? "elite-cron-secret";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Completed bookings from 24–48h ago that haven't received a review request
  const from = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const to   = new Date(Date.now() - 20 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status:        "COMPLETED",
      rideEndedAt:   { gte: from, lte: to },
      guestEmail:    { not: null },
      rating:        null,
    },
  });

  let sent = 0;
  for (const b of bookings) {
    if (!b.guestEmail || !b.guestName) continue;

    const alreadySent = await prisma.emailLog.findFirst({
      where: { to: b.guestEmail, type: "REVIEW", bookingId: b.id },
    });
    if (alreadySent) continue;

    try {
      await sendReviewRequestEmail({
        to:              b.guestEmail,
        name:            b.guestName,
        confirmationCode: b.confirmationCode,
        bookingId:       b.id,
      });
      sent++;

      await notify({
        event:     "REVIEW_REQUEST",
        channels:  ["inapp"],
        userId:    b.userId,
        bookingId: b.id,
        vars: {
          code:  b.confirmationCode,
          route: b.dropoffAddress ? `${b.pickupAddress} → ${b.dropoffAddress}` : b.pickupAddress,
        },
      });
    } catch (err) {
      console.error("[cron/review-request]", err);
    }
  }

  // Flight delays are also swept here. Each cron entry may run only once
  // per day on the Hobby plan, so checking from several existing jobs is
  // the only way to catch a delay announced after the morning run.
  await sweepFlightDelays(36).catch(() => null);

  return NextResponse.json({ ok: true, sent });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
