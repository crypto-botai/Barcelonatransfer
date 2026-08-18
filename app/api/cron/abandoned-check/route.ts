import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createAbandonedCoupon, logEmail } from "@/lib/marketing";
import { sendAbandonedBookingEmail } from "@/lib/resend";

const CRON_SECRET             = process.env.CRON_SECRET ?? "elite-cron-secret";
const ABANDON_AFTER_MINUTES   = 60;   // wait 1 hour before first email
const FOLLOW_UP_HOURS         = 24;   // send follow-ups every 24 hours
const MAX_ABANDONED_EMAILS    = 3;    // stop after 3 emails total
// Stop chasing an abandoned booking once the trip it was for has come and gone.
// Without this the follow-up query selects any unconverted record whose last
// email was over a day ago, so records from June were still queued for
// "follow-ups" about journeys that had already happened.
const FOLLOW_UP_MAX_AGE_DAYS  = 7;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = { newAbandoned: 0, followUps: 0, skipped: 0, errors: 0 };

  // ─── Phase 1: First email for newly-abandoned sessions ──────
  const abandonCutoff = new Date(Date.now() - ABANDON_AFTER_MINUTES * 60_000);

  const newSessions = await prisma.bookingSession.findMany({
    where: {
      email:            { not: null },
      converted:        false,
      lastActivity:     { lt: abandonCutoff },
      abandonedBooking: null,
    },
    take: 30,
  });

  for (const s of newSessions) {
    if (!s.email) continue;
    // The form asks for contact details before showing a price, so an address
    // here does not by itself mean the person agreed to be written to. Only
    // send where they ticked the box on the details step.
    const consented = (s.formData as { contactConsent?: boolean } | null)?.contactConsent === true;
    if (!consented) { results.skipped++; continue; }
    try {
      const couponCode = await createAbandonedCoupon(s.email);
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon) continue;

      const abandoned = await prisma.abandonedBooking.create({
        data: {
          sessionId:    s.sessionId,
          email:        s.email,
          name:         s.name    ?? undefined,
          phone:        s.phone   ?? undefined,
          formSnapshot: s.formData as Prisma.InputJsonValue,
          couponId:     coupon.id,
        },
      });

      await sendAbandonedBookingEmail({
        to:        s.email,
        name:      s.name ?? "there",
        couponCode,
        expiresAt: coupon.expiresAt,
        formData:  s.formData as Record<string, unknown>,
      });

      await prisma.abandonedBooking.update({
        where: { id: abandoned.id },
        data:  { emailSentAt: new Date() },
      });

      results.newAbandoned++;
    } catch (err) {
      console.error("[cron/abandoned-check] new session error", s.sessionId, err);
      await logEmail({ to: s.email!, subject: "Abandoned recovery (FAILED)", type: "ABANDONED", status: "FAILED" });
      results.errors++;
    }
  }

  // ─── Phase 2: Daily follow-ups for existing abandoned ───────
  const followUpCutoff = new Date(Date.now() - FOLLOW_UP_HOURS * 3_600_000);

  const toFollowUp = await prisma.abandonedBooking.findMany({
    where: {
      convertedAt: null,
      emailSentAt: { lt: followUpCutoff },
      createdAt:   { gt: new Date(Date.now() - FOLLOW_UP_MAX_AGE_DAYS * 864e5) },
    },
    include: { coupon: true },
    take: 30,
  });

  for (const ab of toFollowUp) {
    try {
      // Stop if the session was converted elsewhere
      const session = await prisma.bookingSession.findUnique({
        where: { sessionId: ab.sessionId },
        select: { converted: true },
      });
      if (session?.converted) {
        await prisma.abandonedBooking.update({
          where: { id: ab.id },
          data:  { convertedAt: new Date() },
        });
        results.skipped++;
        continue;
      }

      // A pickup date in the past means the journey is over, whatever the
      // record's age says.
      const snapshot = (ab.formSnapshot ?? {}) as { date?: string };
      if (snapshot.date && new Date(snapshot.date) < new Date()) {
        results.skipped++;
        continue;
      }

      // Count how many abandoned emails have already been sent for this email
      const emailCount = await prisma.emailLog.count({
        where: { to: ab.email, type: "ABANDONED" },
      });
      if (emailCount >= MAX_ABANDONED_EMAILS) {
        results.skipped++;
        continue;
      }

      const couponCode = ab.coupon?.code;
      const expiresAt  = ab.coupon?.expiresAt ?? new Date(Date.now() + 48 * 3_600_000);

      await sendAbandonedBookingEmail({
        to:        ab.email,
        name:      ab.name ?? "there",
        couponCode,
        expiresAt,
        formData:  (ab.formSnapshot ?? {}) as Record<string, unknown>,
      });

      await prisma.abandonedBooking.update({
        where: { id: ab.id },
        data:  { emailSentAt: new Date() },
      });

      results.followUps++;
    } catch (err) {
      console.error("[cron/abandoned-check] follow-up error", ab.id, err);
      results.errors++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

// Allow Vercel cron to call via GET
export async function GET(req: NextRequest) {
  return POST(req);
}
