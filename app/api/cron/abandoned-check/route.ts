import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createAbandonedCoupon, logEmail } from "@/lib/marketing";
import { sendAbandonedBookingEmail } from "@/lib/resend";

const CRON_SECRET = process.env.CRON_SECRET ?? "elite-cron-secret";
const ABANDON_AFTER_MINUTES = 20;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - ABANDON_AFTER_MINUTES * 60 * 1000);

  // Find sessions inactive for >20 min, with email, not yet converted or marked abandoned
  const sessions = await prisma.bookingSession.findMany({
    where: {
      email:       { not: null },
      converted:   false,
      lastActivity: { lt: cutoff },
      abandonedBooking: null,
    },
    take: 50,
  });

  let processed = 0;
  for (const s of sessions) {
    if (!s.email) continue;
    try {
      const couponCode = await createAbandonedCoupon(s.email);
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon) continue;

      const abandoned = await prisma.abandonedBooking.create({
        data: {
          sessionId:    s.sessionId,
          email:        s.email,
          name:         s.name ?? undefined,
          phone:        s.phone ?? undefined,
          formSnapshot: s.formData as Prisma.InputJsonValue,
          couponId:     coupon.id,
        },
      });

      await sendAbandonedBookingEmail({
        to:        s.email,
        name:      s.name ?? "there",
        couponCode,
        expiresAt: coupon.expiresAt,
        formData:  s.formData as Record<string, string | undefined>,
      });

      await prisma.abandonedBooking.update({
        where: { id: abandoned.id },
        data:  { emailSentAt: new Date() },
      });

      processed++;
    } catch (err) {
      console.error("[cron/abandoned-check] Error processing session", s.sessionId, err);
      await logEmail({ to: s.email!, subject: "Abandoned recovery (FAILED)", type: "ABANDONED", status: "FAILED" });
    }
  }

  return NextResponse.json({ ok: true, processed });
}

// Also allow Vercel cron GET
export async function GET(req: NextRequest) {
  return POST(req);
}
