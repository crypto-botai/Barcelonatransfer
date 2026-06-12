process.env.DATABASE_URL = "postgresql://neondb_owner:npg_kAYbK9JDliG4@ep-nameless-surf-alkhwnny-pooler.c-3.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
process.env.DIRECT_URL = "postgresql://neondb_owner:npg_kAYbK9JDliG4@ep-nameless-surf-alkhwnny.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const since = new Date(Date.now() - 30 * 86400000);
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        DATE(created_at AT TIME ZONE 'UTC')::text as date,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'PAID'), 0)::float as revenue,
        COUNT(*)::int as bookings
      FROM bookings
      WHERE created_at >= ${since}
      GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY date ASC
    `;
    console.log("Type of bookings field:", typeof rows[0]?.bookings);
    console.log("Chart rows:", JSON.stringify(rows, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));

    const veh = await prisma.booking.groupBy({
      by: ["vehicleClass"],
      _sum: { totalAmount: true },
      _count: { id: true },
      where: { paymentStatus: "PAID" },
      orderBy: { _sum: { totalAmount: "desc" } },
    });
    console.log("Vehicle revenue:", JSON.stringify(veh, null, 2));
  } catch (e) {
    console.error("Query error:", e.message);
  }
  await prisma.$disconnect();
}
main();
