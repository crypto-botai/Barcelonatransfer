import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Adds drivers.notifyEmail to the live database.
 *
 * A one-off, opened once in the browser by an admin and then deleted from the
 * repository. It exists because this project has no migration step in its
 * deploy: the schema is edited here and the column has to reach production
 * somehow, and a signed-in admin hitting a URL is the narrowest door that
 * works. `IF NOT EXISTS` makes it safe to open twice, or to open after the
 * column has already been added by hand.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Sign in as an admin first, then open this link again." }, { status: 401 });
  }

  const applied: string[] = [];
  const failed: { sql: string; error: string }[] = [];

  const statements = [
    `ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "notifyEmail" TEXT`,
  ];

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      applied.push(sql);
    } catch (e) {
      failed.push({ sql, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Read it back, so the answer is what the database has rather than what the
  // statements claim to have done.
  let present = false;
  try {
    const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'notifyEmail'`,
    );
    present = rows.length > 0;
  } catch { /* the check failing does not undo the work above */ }

  return NextResponse.json({ ok: failed.length === 0 && present, applied, failed, present });
}
