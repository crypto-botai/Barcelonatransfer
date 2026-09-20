import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * One-shot migration for deposit payments and cancellation protection.
 *
 * TEMPORARY. Delete this file once it has run.
 *
 * Same arrangement as the fleet-partner migration before it: the production
 * database is only reachable from inside the application, so the migration
 * runs from a route the owner opens in the browser while signed in as admin.
 *
 * What keeps it safe:
 *   - ADMIN session required, like every route under /api/admin.
 *   - Fixed statements; nothing is read from the request.
 *   - Every statement is idempotent, so a second run is harmless.
 *   - It only ever adds nullable columns. No DROP, no UPDATE, no row touched.
 */

const STEPS: { name: string; sql: string }[] = [
  {
    name: "columns bookings.protectionFee / balanceMethod / balancePaidBy",
    sql: `
      ALTER TABLE "bookings"
        ADD COLUMN IF NOT EXISTS "protectionFee" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "balanceMethod" TEXT,
        ADD COLUMN IF NOT EXISTS "balancePaidBy" TEXT;
    `,
  },
];

const EXPECTED: { table: string; column: string }[] = [
  { table: "bookings", column: "depositAmount" },
  { table: "bookings", column: "balanceAmount" },
  { table: "bookings", column: "balancePaidAt" },
  { table: "bookings", column: "protectionFee" },
  { table: "bookings", column: "balanceMethod" },
  { table: "bookings", column: "balancePaidBy" },
];

async function run() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
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

  const missing: string[] = [];
  for (const { table, column } of EXPECTED) {
    const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      table, column,
    ).catch(() => [{ n: 0 }]);
    if (!rows[0] || rows[0].n === 0) missing.push(`${table}.${column}`);
  }

  return NextResponse.json({ ok: failed.length === 0 && missing.length === 0, applied, failed, missing });
}

export async function GET() { return run(); }
export async function POST() { return run(); }
