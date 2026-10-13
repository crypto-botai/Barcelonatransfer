/**
 * Read-only connectivity check for the STAGING database (the one Vercel Preview uses). Run from your own machine with the staging
 * variables set in that one terminal (see docs/STAGING.md section 4.1):
 *
 *   set APP_ENV=staging
 *   set POSTGRES_PRISMA_URL=<staging pooled URL>
 *   set POSTGRES_URL_NON_POOLING=<staging direct URL>
 *   npx tsx scripts/staging/check-connection.ts
 *
 * It refuses to run unless the staging guard passes (same rules as db:push:staging), then runs only SELECT statements: it never
 * writes, never migrates, and prints no host, user, password or URL. It reports whether the live-tracking tables and columns exist.
 */
import { PrismaClient } from "@prisma/client";
import { assessDatabaseSafety, databaseHostFingerprints, resolveAppEnvironment } from "../../lib/env-guard";

const env = process.env as Record<string, string | undefined>;
if (resolveAppEnvironment(env) !== "staging") {
  console.error('check-connection: APP_ENV must be "staging". Nothing was contacted.');
  process.exit(1);
}
const verdict = assessDatabaseSafety(env);
if (!verdict.ok) {
  console.error(`check-connection: ${verdict.reason} Nothing was contacted.`);
  process.exit(1);
}
if (databaseHostFingerprints(env).length === 0) {
  console.error("check-connection: no database variable is set (POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING). Nothing was contacted.");
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`connected in ${Date.now() - t0} ms`);
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('bookings', 'drivers', 'vehicles', 'ride_tracking', 'activity_logs')`;
    const have = new Set(tables.map((t) => t.table_name));
    for (const name of ["bookings", "drivers", "vehicles", "ride_tracking", "activity_logs"]) console.log(`table ${name}: ${have.has(name) ? "present" : "MISSING"}`);
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name IN ('customerLat', 'customerLng', 'customerLocatedAt', 'rideStage')`;
    const haveCols = new Set(cols.map((c) => c.column_name));
    for (const name of ["customerLat", "customerLng", "customerLocatedAt", "rideStage"]) console.log(`bookings.${name}: ${haveCols.has(name) ? "present" : "MISSING"}`);
  } catch (e) {
    console.error(`check-connection: could not query the database (${e instanceof Error ? e.name : "error"}). The message is not printed because it can contain connection details.`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
