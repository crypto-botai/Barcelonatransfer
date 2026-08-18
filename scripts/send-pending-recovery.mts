/**
 * Send the recovery email to sessions the daily cron has not reached yet.
 *
 * The cron runs once at 05:30. Someone who abandons just after that waits
 * almost a full day, by which time an airport transfer has usually been booked
 * elsewhere. This is the same work the cron's first phase does — same coupon,
 * same email, same records — run on demand.
 *
 * It applies exactly the cron's conditions, including consent, so it can never
 * write to somebody the cron would have skipped. Follow-ups are not touched:
 * this only sends a first email to a session that has never had one.
 *
 *   npx tsx --env-file=.env.local scripts/send-pending-recovery.mts          # show who
 *   npx tsx --env-file=.env.local scripts/send-pending-recovery.mts --send   # send
 */
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { createAbandonedCoupon } from "../lib/marketing";
import { sendAbandonedBookingEmail } from "../lib/resend";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const ABANDON_AFTER_MINUTES = 60;

const mask = (e: string) => e.replace(/^(.).*(@.*)$/, (_, a, b) => `${a}***${b}`);

async function main() {
  console.log(SEND ? "SENDING\n" : "DRY RUN — pass --send to actually email\n");

  const sessions = await prisma.bookingSession.findMany({
    where: {
      email: { not: null },
      converted: false,
      lastActivity: { lt: new Date(Date.now() - ABANDON_AFTER_MINUTES * 60_000) },
      abandonedBooking: null,
    },
    take: 30,
  });

  let sent = 0;
  let skipped = 0;

  for (const s of sessions) {
    if (!s.email) continue;

    // Same consent gate as the cron. Contact details are taken before the price
    // is shown, so holding an address is not the same as agreeing to be written
    // to.
    const consented = (s.formData as { contactConsent?: boolean } | null)?.contactConsent === true;
    if (!consented) {
      skipped++;
      console.log(`  skip  ${mask(s.email)} — no consent given`);
      continue;
    }

    console.log(`  send  ${mask(s.email)}  (abandoned ${s.lastActivity.toISOString().slice(0, 16)}, step ${s.step})`);
    if (!SEND) continue;

    try {
      const couponCode = await createAbandonedCoupon(s.email);
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon) throw new Error("coupon was not created");

      const abandoned = await prisma.abandonedBooking.create({
        data: {
          sessionId:    s.sessionId,
          email:        s.email,
          name:         s.name  ?? undefined,
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
        formData:  s.formData as Record<string, unknown>,
      });

      await prisma.abandonedBooking.update({
        where: { id: abandoned.id },
        data:  { emailSentAt: new Date() },
      });

      sent++;
      console.log(`        sent · coupon ${couponCode} · 5% off · expires ${coupon.expiresAt.toISOString().slice(0, 16)}`);
    } catch (err) {
      console.error(`        FAILED for ${mask(s.email)}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    `\n${sessions.length} eligible · ${SEND ? `${sent} sent` : "none sent (dry run)"} · ${skipped} skipped for consent`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
