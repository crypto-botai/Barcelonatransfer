/**
 * Read-only comparison of the pricing database against FIXED_ROUTES.
 *
 * Confirms the eight new rows landed with the right fares, and — more
 * importantly — that publishing them changed nothing else. prisma/seed.ts
 * carries a stale second copy of the table, so drift between the database and
 * lib/fixed-prices.ts is worth being able to see on demand.
 */
import { PrismaClient } from "@prisma/client";
import { FIXED_ROUTES, type VehicleCode } from "../lib/fixed-prices";
import { ZONE_CODE_TO_KEY } from "../lib/pricing";

const prisma = new PrismaClient();
const CODES: VehicleCode[] = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"];

async function main() {
  const rows = await prisma.route.findMany({ where: { active: true }, include: { prices: true } });
  console.log(`${rows.length} active routes in the database, ${FIXED_ROUTES.length} in the table\n`);

  const drift: string[] = [];
  const missing: string[] = [];

  for (const r of FIXED_ROUTES) {
    const fromKey = ZONE_CODE_TO_KEY[r.from];
    const toKey = ZONE_CODE_TO_KEY[r.to];
    const row = rows.find(
      (x) => (x.fromKey === fromKey && x.toKey === toKey) ||
             (x.fromKey === toKey && x.toKey === fromKey),
    );
    if (!row) {
      missing.push(`${r.fromLabel} → ${r.toLabel}`);
      continue;
    }
    for (const code of CODES) {
      const dbPrice = row.prices.find((p) => p.vehicleCode === code)?.price;
      if (dbPrice !== undefined && dbPrice !== r.prices[code]) {
        drift.push(
          `${row.slug.padEnd(32)} ${code.padEnd(9)} db €${String(dbPrice).padEnd(5)} table €${r.prices[code]}`,
        );
      }
    }
  }

  if (missing.length) {
    console.log(`Not published to the database (${missing.length}) — these quote from the table:`);
    for (const m of missing) console.log(`  ${m}`);
    console.log();
  }
  if (drift.length) {
    console.log(`PRICE DRIFT (${drift.length}) — the database and the table disagree:`);
    for (const d of drift) console.log(`  ${d}`);
  } else {
    console.log("No price drift: every published route matches the table.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
