import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * One-shot migration: adds Booking.returnOfId so a round trip can be stored.
 *
 * TEMPORARY. Delete this file once it has run — see the note at the end.
 *
 * Why it exists at all. The column has to be added to the production database
 * and there was no way to reach that database by hand: Vercel marks the
 * connection strings Sensitive, so `vercel env pull` writes "[SENSITIVE]"
 * rather than the value, and the Query console in the Vercel dashboard
 * answers "An unexpected internal error occurred" to every statement,
 * including a read-only SELECT against information_schema.
 *
 * The application, though, holds the credentials already — it queries this
 * database on every quote. So the migration runs here, from inside the server
 * that can already connect, and the password never has to be copied anywhere.
 * That is a smaller exposure than moving a production password around, not a
 * larger one.
 *
 * What keeps it safe:
 *   - ADMIN session required, exactly like every other route under /api/admin.
 *   - It executes three fixed statements. Nothing is read from the request,
 *     so there is no input to inject through.
 *   - Every statement is idempotent, so running it twice is harmless and a
 *     partly-applied migration completes rather than erroring.
 *   - It only ever adds. No DROP, no UPDATE, no data touched. Existing
 *     bookings get NULL in a new optional column and behave as before.
 *
 * Verified against prisma/schema.prisma with:
 *   prisma migrate diff --from-schema-datamodel <schema without the fields> \
 *                       --to-schema-datamodel prisma/schema.prisma --script
 */

const STEPS: { name: string; sql: string }[] = [
  {
    name: "column bookings.returnOfId",
    sql: `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "returnOfId" TEXT;`,
  },
  {
    // One booking can be the return leg of exactly one other.
    name: "unique index bookings_returnOfId_key",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "bookings_returnOfId_key" ON "bookings"("returnOfId");`,
  },
  {
    // ADD CONSTRAINT has no IF NOT EXISTS, so the existence check is explicit.
    // ON DELETE SET NULL: deleting an outbound booking orphans its return leg
    // rather than silently deleting a journey someone has paid for.
    name: "foreign key bookings_returnOfId_fkey",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'bookings_returnOfId_fkey'
        ) THEN
          ALTER TABLE "bookings" ADD CONSTRAINT "bookings_returnOfId_fkey"
            FOREIGN KEY ("returnOfId") REFERENCES "bookings"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `,
  },
];

async function run() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; email?: string } | undefined;
  if (!session || user?.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Sign in as an admin first, then open this link again." },
      { status: 401 },
    );
  }

  const applied: string[] = [];
  const failed: { step: string; error: string }[] = [];

  for (const step of STEPS) {
    try {
      await prisma.$executeRawUnsafe(step.sql);
      applied.push(step.name);
    } catch (e) {
      failed.push({ step: step.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Read the schema back rather than trusting the statements returned cleanly.
  let columnPresent = false;
  try {
    const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'bookings' AND column_name = 'returnOfId'`,
    );
    columnPresent = rows.length > 0;
  } catch (e) {
    failed.push({ step: "verify", error: e instanceof Error ? e.message : String(e) });
  }

  console.info(
    `[migrate-return-leg] ${user.email ?? "admin"} applied=${applied.join(", ")} ` +
    `failed=${failed.length} columnPresent=${columnPresent}`,
  );

  return NextResponse.json({
    ok: columnPresent && failed.length === 0,
    columnPresent,
    applied,
    failed,
    next: columnPresent
      ? "Done. Tell Claude the migration is applied and the return trip can be switched on."
      : "The column is still missing — send this whole response back to Claude.",
  });
}

// GET as well as POST purely so it can be opened in a browser. It is
// idempotent and admin-only, and this file is deleted once the column exists.
export async function GET()  { return run(); }
export async function POST() { return run(); }
