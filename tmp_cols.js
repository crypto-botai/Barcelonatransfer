process.env.DATABASE_URL = "postgresql://neondb_owner:npg_kAYbK9JDliG4@ep-nameless-surf-alkhwnny-pooler.c-3.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
process.env.DIRECT_URL = "postgresql://neondb_owner:npg_kAYbK9JDliG4@ep-nameless-surf-alkhwnny.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const cols = await prisma.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'bookings' AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  console.log("Bookings columns:", JSON.stringify(cols, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
