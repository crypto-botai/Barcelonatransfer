import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Creates contact_enquiries, once, from inside the running app.
 *
 * `prisma db push` needs the database password on somebody's machine. The
 * app already holds a working connection, so the table can be made from here
 * instead and no credential has to travel anywhere to do it.
 *
 * Deliberately narrow: three fixed statements, all IF NOT EXISTS, no input of
 * any kind. It cannot drop, alter or read anything, running it twice does
 * nothing the second time, and it is admin-only. Delete this route once the
 * table exists — it has no reason to stay on a live site.
 *
 * The SQL is what `prisma migrate diff` generates for the ContactEnquiry
 * model, with IF NOT EXISTS added so a re-run is harmless.
 */

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "contact_enquiries" (
     "id" TEXT NOT NULL,
     "name" TEXT NOT NULL,
     "email" TEXT NOT NULL,
     "phone" TEXT,
     "message" TEXT NOT NULL,
     "status" TEXT NOT NULL DEFAULT 'PENDING',
     "emailError" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "contact_enquiries_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE INDEX IF NOT EXISTS "contact_enquiries_status_idx" ON "contact_enquiries"("status")`,
  `CREATE INDEX IF NOT EXISTS "contact_enquiries_createdAt_idx" ON "contact_enquiries"("createdAt")`,
];

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json(
      { error: "Sign in as an admin first, then open this link again." },
      { status: 401 },
    );
  }

  const applied: string[] = [];
  const failed: { statement: string; error: string }[] = [];

  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql);
      applied.push(sql.split("\n")[0].trim());
    } catch (err) {
      failed.push({
        statement: sql.split("\n")[0].trim(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Prove it worked by using it the way the contact form does, then clean up
  // after itself. A table that exists but cannot be written to is not done.
  let writable = false;
  let writeError: string | null = null;
  try {
    const probe = await prisma.contactEnquiry.create({
      data: {
        name: "Setup Check",
        email: "setup@elitebcn.info",
        message: "Written and deleted by the one-time table setup.",
        status: "PENDING",
      },
      select: { id: true },
    });
    await prisma.contactEnquiry.delete({ where: { id: probe.id } });
    writable = true;
  } catch (err) {
    writeError = err instanceof Error ? err.message : String(err);
  }

  const ok = failed.length === 0 && writable;
  return NextResponse.json(
    {
      ok,
      applied,
      failed,
      writable,
      writeError,
      note: ok
        ? "contact_enquiries exists and accepts writes. The contact form now keeps a copy of every message. This route can be deleted."
        : "Something did not apply. The errors above say what.",
    },
    { status: ok ? 200 : 500 },
  );
}
