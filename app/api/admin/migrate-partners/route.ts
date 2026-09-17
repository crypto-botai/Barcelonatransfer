import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * One-shot migration for manual bookings and fleet partner companies.
 *
 * TEMPORARY. Delete this file once it has run.
 *
 * Same arrangement as the return-leg migration before it: the production
 * database cannot be reached by hand (Vercel keeps the connection strings
 * Sensitive and its query console errors on every statement), but the
 * application connects to it on every request, so the migration runs from
 * inside the server. The password never has to be copied anywhere.
 *
 * What keeps it safe:
 *   - ADMIN session required, like every route under /api/admin.
 *   - Fixed statements; nothing is read from the request.
 *   - Every statement is idempotent, so a second run is harmless and a
 *     partly-applied migration completes rather than erroring.
 *   - It only ever adds: new enum values, nullable columns, new tables. No
 *     DROP, no UPDATE, no existing row touched.
 *
 * The SQL is what `prisma migrate diff` produced between the schema before
 * and after, with IF NOT EXISTS added and CREATE TYPE / ADD CONSTRAINT
 * wrapped in existence checks, since those have no such clause.
 */

const STEPS: { name: string; sql: string }[] = [
  {
    name: "enum BookingPaymentMethod",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingPaymentMethod') THEN
          CREATE TYPE "BookingPaymentMethod" AS ENUM ('CARD_LINK', 'WHATSAPP', 'CASH', 'BANK_TRANSFER');
        END IF;
      END $$;
    `,
  },
  {
    name: "enum Role + PARTNER",
    sql: `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PARTNER';`,
  },
  {
    name: "column drivers.partnerId",
    sql: `ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;`,
  },
  {
    name: "columns bookings.payment*/partner*",
    sql: `
      ALTER TABLE "bookings"
        ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "paidMarkedBy" TEXT,
        ADD COLUMN IF NOT EXISTS "partnerAssignedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "partnerDispatchedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "partnerId" TEXT,
        ADD COLUMN IF NOT EXISTS "partnerPayout" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "paymentMethod" "BookingPaymentMethod",
        ADD COLUMN IF NOT EXISTS "customerLat" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "customerLng" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "customerLocatedAt" TIMESTAMP(3);
    `,
  },
  {
    name: "table fleet_partners",
    sql: `
      CREATE TABLE IF NOT EXISTS "fleet_partners" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "contactName" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "taxId" TEXT,
        "address" TEXT,
        "bankHolder" TEXT,
        "bankIban" TEXT,
        "bizumPhone" TEXT,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "fleet_partners_pkey" PRIMARY KEY ("id")
      );
    `,
  },
  {
    name: "table partner_withdrawals",
    sql: `
      CREATE TABLE IF NOT EXISTS "partner_withdrawals" (
        "id" TEXT NOT NULL,
        "partnerId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "method" "WithdrawalMethod" NOT NULL,
        "bankIban" TEXT,
        "bankHolder" TEXT,
        "bizumPhone" TEXT,
        "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "partner_withdrawals_pkey" PRIMARY KEY ("id")
      );
    `,
  },
  {
    name: "enum TripSender + table trip_messages",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TripSender') THEN
          CREATE TYPE "TripSender" AS ENUM ('CUSTOMER', 'DRIVER', 'PARTNER', 'ADMIN');
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS "trip_messages" (
        "id" TEXT NOT NULL,
        "bookingId" TEXT NOT NULL,
        "sender" "TripSender" NOT NULL,
        "senderName" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "trip_messages_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "trip_messages_bookingId_createdAt_idx" ON "trip_messages"("bookingId", "createdAt");
    `,
  },
  {
    name: "indexes",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS "fleet_partners_userId_key" ON "fleet_partners"("userId");
      CREATE INDEX IF NOT EXISTS "fleet_partners_active_idx" ON "fleet_partners"("active");
      CREATE INDEX IF NOT EXISTS "partner_withdrawals_partnerId_status_idx" ON "partner_withdrawals"("partnerId", "status");
    `,
  },
  {
    name: "foreign keys",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_partnerId_fkey') THEN
          ALTER TABLE "drivers" ADD CONSTRAINT "drivers_partnerId_fkey"
            FOREIGN KEY ("partnerId") REFERENCES "fleet_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_partnerId_fkey') THEN
          ALTER TABLE "bookings" ADD CONSTRAINT "bookings_partnerId_fkey"
            FOREIGN KEY ("partnerId") REFERENCES "fleet_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fleet_partners_userId_fkey') THEN
          ALTER TABLE "fleet_partners" ADD CONSTRAINT "fleet_partners_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_messages_bookingId_fkey') THEN
          ALTER TABLE "trip_messages" ADD CONSTRAINT "trip_messages_bookingId_fkey"
            FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_withdrawals_partnerId_fkey') THEN
          ALTER TABLE "partner_withdrawals" ADD CONSTRAINT "partner_withdrawals_partnerId_fkey"
            FOREIGN KEY ("partnerId") REFERENCES "fleet_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `,
  },
];

/** Everything the feature code will select; all must exist before it deploys. */
const EXPECTED: { table: string; column: string }[] = [
  { table: "bookings", column: "paymentMethod" },
  { table: "bookings", column: "paidAt" },
  { table: "bookings", column: "partnerId" },
  { table: "bookings", column: "partnerPayout" },
  { table: "bookings", column: "partnerDispatchedAt" },
  { table: "bookings", column: "customerLocatedAt" },
  { table: "drivers", column: "partnerId" },
  { table: "fleet_partners", column: "bankIban" },
  { table: "partner_withdrawals", column: "status" },
  { table: "trip_messages", column: "sender" },
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
      // The index step holds several statements; executeRawUnsafe sends the
      // string as one simple query, which PostgreSQL accepts.
      await prisma.$executeRawUnsafe(step.sql);
      applied.push(step.name);
    } catch (e) {
      failed.push({ step: step.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Read the schema back rather than trusting the statements returned cleanly.
  const missing: string[] = [];
  try {
    const rows = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_name IN ('bookings', 'drivers', 'fleet_partners', 'partner_withdrawals', 'trip_messages')`,
    );
    const have = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    for (const e of EXPECTED) if (!have.has(`${e.table}.${e.column}`)) missing.push(`${e.table}.${e.column}`);
  } catch (e) {
    failed.push({ step: "verify", error: e instanceof Error ? e.message : String(e) });
  }

  let partnerRole = false;
  try {
    const rows = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'Role'`,
    );
    partnerRole = rows.some((r) => r.enumlabel === "PARTNER");
  } catch (e) {
    failed.push({ step: "verify role", error: e instanceof Error ? e.message : String(e) });
  }

  const ok = missing.length === 0 && partnerRole && failed.length === 0;
  console.info(
    `[migrate-partners] ${user.email ?? "admin"} applied=${applied.join(", ")} ` +
    `failed=${failed.length} missing=${missing.join(",")} partnerRole=${partnerRole}`,
  );

  return NextResponse.json({
    ok,
    applied,
    failed,
    missing,
    partnerRole,
    next: ok
      ? "Done. Tell Claude the migration is applied."
      : "Something is still missing — send this whole response back to Claude.",
  });
}

// GET as well as POST purely so it can be opened in a browser. Idempotent and
// admin-only; this file is deleted once the schema is in place.
export async function GET()  { return run(); }
export async function POST() { return run(); }
