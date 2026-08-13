/**
 * Bring the pricing database up to lib/fixed-prices.ts.
 *
 * The take-higher reprice of 13 Aug 2026 changed the table, and the table is
 * what every page displays — but lookupFixedPrice() reads the database first
 * and only falls back to the table for routes the database does not hold. The
 * raised fares therefore reached the pages and not the checkout: the site
 * advertised the airport ⇄ city Business fare at €70 and charged €60, verified
 * against the live quote endpoint.
 *
 * Refuses to lower a price. Every difference found was the database sitting
 * below the table, which is the direction this is meant to correct; a route
 * where the database is higher is reported and left alone, because that is not
 * a case this script can be sure about.
 *
 *   npx tsx --env-file=.env.local scripts/sync-db-prices.mts           # dry run
 *   npx tsx --env-file=.env.local scripts/sync-db-prices.mts --apply
 */
import { PrismaClient } from "@prisma/client";
import { FIXED_ROUTES, type VehicleCode } from "../lib/fixed-prices";
import { ZONE_CODE_TO_KEY } from "../lib/pricing";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const CODES: VehicleCode[] = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"];

async function main() {
  console.log(APPLY ? "APPLYING\n" : "DRY RUN — pass --apply to write\n");

  const rows = await prisma.route.findMany({ where: { active: true }, include: { prices: true } });

  const raise: { id: string; slug: string; code: string; from: number; to: number }[] = [];
  const refused: string[] = [];

  for (const r of FIXED_ROUTES) {
    const fromKey = ZONE_CODE_TO_KEY[r.from];
    const toKey = ZONE_CODE_TO_KEY[r.to];
    const row = rows.find(
      (x) => (x.fromKey === fromKey && x.toKey === toKey) ||
             (x.fromKey === toKey && x.toKey === fromKey),
    );
    if (!row) continue;

    for (const code of CODES) {
      const current = row.prices.find((p) => p.vehicleCode === code);
      if (!current || current.price === r.prices[code]) continue;

      if (current.price > r.prices[code]) {
        refused.push(
          `${row.slug.padEnd(32)} ${code.padEnd(9)} db €${current.price} is ABOVE table €${r.prices[code]} — left alone`,
        );
        continue;
      }
      raise.push({ id: current.id, slug: row.slug, code, from: current.price, to: r.prices[code] });
    }
  }

  for (const p of raise) {
    console.log(`RAISE  ${p.slug.padEnd(32)} ${p.code.padEnd(9)} €${p.from} → €${p.to}`);
  }
  for (const line of refused) console.log(`REFUSE ${line}`);

  if (APPLY && raise.length) {
    for (const p of raise) {
      await prisma.routePrice.update({
        where: { id: p.id },
        data:  { price: p.to, updatedBy: "sync-db-prices" },
      });
    }
  }

  console.log(`\n${raise.length} raised, ${refused.length} refused`);
  if (raise.length && APPLY) {
    console.log("Bump the unstable_cache suffix in lib/pricing-service.ts so /pricing re-reads.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
