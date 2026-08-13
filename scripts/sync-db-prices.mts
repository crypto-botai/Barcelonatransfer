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
 * Refuses to lower a price unless asked. The drift this exists to fix is the
 * database sitting BELOW the table; a price going down is a different event and
 * has to be requested with --allow-lower, so a reduction is never something the
 * script does by itself.
 *
 *   npx tsx --env-file=.env.local scripts/sync-db-prices.mts                # dry run
 *   npx tsx --env-file=.env.local scripts/sync-db-prices.mts --apply
 *   npx tsx --env-file=.env.local scripts/sync-db-prices.mts --allow-lower --apply
 */
import { PrismaClient } from "@prisma/client";
import { FIXED_ROUTES, type VehicleCode } from "../lib/fixed-prices";
import { ZONE_CODE_TO_KEY } from "../lib/pricing";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
// Reductions are opt-in. This script was written to close an upward gap — the
// database sitting below the table — and a price falling is a different event
// that deserves to be asked for explicitly.
const ALLOW_LOWER = process.argv.includes("--allow-lower");
const CODES: VehicleCode[] = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"];

async function main() {
  console.log(APPLY ? "APPLYING\n" : "DRY RUN — pass --apply to write\n");

  const rows = await prisma.route.findMany({ where: { active: true }, include: { prices: true } });

  const raise: { id: string; slug: string; code: string; from: number; to: number }[] = [];
  const refused: string[] = [];
  const lowered: string[] = [];

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
        // A price going DOWN is not the drift this script exists to fix, so it
        // needs saying out loud. --allow-lower is how an intentional reduction
        // gets through; without it the row is reported and left alone.
        if (!ALLOW_LOWER) {
          refused.push(
            `${row.slug.padEnd(32)} ${code.padEnd(9)} db €${current.price} is ABOVE table €${r.prices[code]}` +
            ` — left alone (pass --allow-lower to reduce it)`,
          );
          continue;
        }
        lowered.push(`${row.slug.padEnd(32)} ${code.padEnd(9)} €${current.price} → €${r.prices[code]}`);
      }
      raise.push({ id: current.id, slug: row.slug, code, from: current.price, to: r.prices[code] });
    }
  }

  for (const p of raise) {
    // Direction in the label, so a reduction never reads as an increase.
    const dir = p.to > p.from ? "RAISE " : "LOWER ";
    console.log(`${dir} ${p.slug.padEnd(32)} ${p.code.padEnd(9)} €${p.from} → €${p.to}`);
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

  console.log(
    `\n${raise.length} changed` +
    (lowered.length ? ` (${lowered.length} of them reductions)` : "") +
    `, ${refused.length} refused`,
  );
  if (raise.length && APPLY) {
    console.log("Bump the unstable_cache suffix in lib/pricing-service.ts so /pricing re-reads.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
