/**
 * Read-only check that every booking already in the database parses.
 *
 * Extras live in a [META]{…}[/META] block on specialRequests, and the format
 * has changed over the life of the site — early bookings stored the price the
 * client sent, later ones the price the server priced. This runs the shared
 * parser over every stored booking and reports what it finds, so a historic
 * shape that no longer parses shows up here rather than as a blank Extras
 * section in the admin.
 *
 * Prints no names, emails or phone numbers: the confirmation code is enough to
 * find a booking, and the rest is not needed to judge whether parsing works.
 *
 *   npx tsx --env-file=.env.local scripts/audit-booking-extras.mts
 */
import { PrismaClient } from "@prisma/client";
import { parseBookingMeta, formatExtras } from "../lib/booking-meta";

const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    select: {
      confirmationCode: true,
      createdAt: true,
      specialRequests: true,
      totalAmount: true,
      flightNumber: true,
      luggage: true,
      vehicleClass: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`${bookings.length} bookings in the database\n`);

  let withMeta = 0;
  let withExtras = 0;
  let withNotes = 0;
  let unparseable = 0;
  const extraCounts = new Map<string, number>();

  for (const b of bookings) {
    const hasBlock = /\[META\]/.test(b.specialRequests ?? "");
    if (hasBlock) withMeta++;

    const meta = parseBookingMeta(b.specialRequests);

    // A block that is present but yields nothing at all is the case worth
    // seeing: it means a historic shape the parser does not understand.
    if (hasBlock && !meta.bookingType && meta.extras.length === 0 && meta.extrasCost === 0) {
      unparseable++;
      console.log(`  UNPARSED  ${b.confirmationCode}  ${b.createdAt.toISOString().slice(0, 10)}`);
      console.log(`            ${(b.specialRequests ?? "").slice(0, 160)}`);
    }

    if (meta.notes) withNotes++;

    if (meta.extras.length) {
      withExtras++;
      for (const e of meta.extras) {
        extraCounts.set(e.id || e.label, (extraCounts.get(e.id || e.label) ?? 0) + e.quantity);
      }
      console.log(
        `  ${b.confirmationCode}  ${b.createdAt.toISOString().slice(0, 10)}  ` +
        `€${b.totalAmount.toFixed(2)}  ${formatExtras(meta.extras)}` +
        (meta.extrasCost ? `  (stored subtotal €${meta.extrasCost.toFixed(2)})` : ""),
      );
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`bookings                : ${bookings.length}`);
  console.log(`with a metadata block   : ${withMeta}`);
  console.log(`with extras booked      : ${withExtras}`);
  console.log(`with a customer note    : ${withNotes}`);
  console.log(`block present but unread: ${unparseable}`);
  if (extraCounts.size) {
    console.log("\nextras ever booked:");
    for (const [id, n] of [...extraCounts].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${id.padEnd(16)} ${n}`);
    }
  }
  console.log(
    unparseable === 0
      ? "\nEvery stored booking parses."
      : `\n${unparseable} bookings carry a block the parser does not read — see above.`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
