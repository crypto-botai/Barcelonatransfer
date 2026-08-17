/**
 * Read-only diagnosis of the abandoned-booking funnel.
 *
 * The admin chart shows nothing despite plenty of traffic. The funnel is:
 * the booking form saves a BookingSession, and a daily cron promotes stale
 * unconverted sessions to AbandonedBooking. This reports where records stop
 * appearing, so the empty chart can be attributed to a specific step rather
 * than guessed at.
 *
 * Prints no email addresses or phone numbers.
 *
 *   npx tsx --env-file=.env.local scripts/audit-abandoned.mts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ABANDON_AFTER_MINUTES = 60; // must match the cron

async function main() {
  const [sessions, abandoned, bookings] = await Promise.all([
    prisma.bookingSession.findMany({
      select: {
        sessionId: true, email: true, name: true, phone: true,
        step: true, converted: true, lastActivity: true, createdAt: true,
        abandonedBooking: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.abandonedBooking.count(),
    prisma.booking.count(),
  ]);

  console.log(`booking sessions   : ${sessions.length}`);
  console.log(`abandoned bookings : ${abandoned}`);
  console.log(`real bookings      : ${bookings}\n`);

  if (sessions.length === 0) {
    console.log("No sessions at all. The form is not reaching /api/booking-session,");
    console.log("so nothing can ever be promoted to abandoned.");
    return;
  }

  const cutoff = new Date(Date.now() - ABANDON_AFTER_MINUTES * 60_000);
  const withEmail = sessions.filter((s) => s.email);
  const converted = sessions.filter((s) => s.converted);
  const stale = sessions.filter((s) => s.lastActivity < cutoff);
  const promoted = sessions.filter((s) => s.abandonedBooking);

  // Exactly the cron's own filter.
  const eligible = sessions.filter(
    (s) => s.email && !s.converted && s.lastActivity < cutoff && !s.abandonedBooking,
  );

  console.log("Funnel:");
  console.log(`  sessions saved                    ${sessions.length}`);
  console.log(`  ...with an email captured         ${withEmail.length}`);
  console.log(`  ...not converted                  ${sessions.length - converted.length}`);
  console.log(`  ...older than ${ABANDON_AFTER_MINUTES} min             ${stale.length}`);
  console.log(`  ...already promoted               ${promoted.length}`);
  console.log(`  => eligible for the cron NOW       ${eligible.length}`);

  const byStep = new Map<number, number>();
  for (const s of sessions) byStep.set(s.step, (byStep.get(s.step) ?? 0) + 1);
  console.log("\nHow far people get (step reached):");
  for (const [step, n] of [...byStep].sort((a, b) => a[0] - b[0])) {
    const pct = Math.round((n / sessions.length) * 100);
    console.log(`  step ${step}   ${String(n).padStart(4)}  ${"█".repeat(Math.round(pct / 2))} ${pct}%`);
  }

  const noContact = sessions.filter((s) => !s.email && !s.phone && !s.name).length;
  console.log(`\nsessions with no contact detail at all: ${noContact}` +
    ` (${Math.round((noContact / sessions.length) * 100)}%)`);
  console.log("These can never become abandoned bookings: the cron requires an email,");
  console.log("and without one there is nobody to send a recovery offer to.");

  const newest = sessions[sessions.length - 1];
  const oldest = sessions[0];
  console.log(`\nfirst session : ${oldest.createdAt.toISOString().slice(0, 16)}`);
  console.log(`last session  : ${newest.createdAt.toISOString().slice(0, 16)}`);

  if (eligible.length > 0 && abandoned === 0) {
    console.log(
      `\n${eligible.length} sessions meet every condition but none was promoted —` +
      " the cron is not running.",
    );
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
