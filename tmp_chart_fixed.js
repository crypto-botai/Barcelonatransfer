process.env.DATABASE_URL = "postgresql://neondb_owner:npg_kAYbK9JDliG4@ep-nameless-surf-alkhwnny-pooler.c-3.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
process.env.DIRECT_URL = "postgresql://neondb_owner:npg_kAYbK9JDliG4@ep-nameless-surf-alkhwnny.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await prisma.$queryRaw`
    SELECT
      DATE("createdAt" AT TIME ZONE 'UTC')::text as date,
      COALESCE(SUM("totalAmount") FILTER (WHERE "paymentStatus" = 'PAID'), 0)::float as revenue,
      COUNT(*)::int as bookings
    FROM bookings
    WHERE "createdAt" >= ${since}
    GROUP BY DATE("createdAt" AT TIME ZONE 'UTC')
    ORDER BY date ASC
  `;
  console.log("Fixed chart rows:", JSON.stringify(rows, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
