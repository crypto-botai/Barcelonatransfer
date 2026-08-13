/**
 * Publish the four destinations added on 13 Aug 2026 to the pricing database,
 * so they appear on /pricing and become editable in Admin → Pricing.
 *
 * Deliberately NOT prisma/seed.ts. That file carries its own hand-copied price
 * table which has since gone stale — it still has the airport ⇄ city Business
 * fare at €60 against the €70 now in force — and its routePrice upsert
 * overwrites, so running it would quietly roll three fares back. This touches
 * only the eight rows named below and reads every figure from FIXED_ROUTES.
 *
 * Idempotent, and refuses to change a price that already exists: if a route is
 * already published, it is reported and left exactly as it is. Nothing here can
 * reprice live routes.
 *
 *   npx tsx scripts/publish-new-routes.mts            # dry run, prints the plan
 *   npx tsx scripts/publish-new-routes.mts --apply    # writes
 */
import { PrismaClient } from "@prisma/client";
import { FIXED_ROUTES, type VehicleCode } from "../lib/fixed-prices";
import { ZONE_CODE_TO_KEY } from "../lib/pricing";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// The eight routes to publish, by their slug in FIXED_ROUTES.
const SLUGS = [
  "bcn-airport-girona-city",
  "barcelona-city-girona-city",
  "bcn-airport-begur",
  "barcelona-city-begur",
  "bcn-airport-vilanova",
  "barcelona-city-vilanova",
  "bcn-airport-reus-airport",
  "barcelona-city-reus-airport",
];

const CODES: VehicleCode[] = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"];

async function main() {
  console.log(APPLY ? "APPLYING\n" : "DRY RUN — pass --apply to write\n");

  // Existing rows set the sort order, so the new ones land at the end of the
  // list rather than renumbering anything already published.
  const maxOrder = await prisma.route.aggregate({ _max: { sortOrder: true } });
  let order = (maxOrder._max.sortOrder ?? 0) + 1;

  let created = 0;
  let skipped = 0;

  for (const slug of SLUGS) {
    const route = FIXED_ROUTES.find((r) => r.slug === slug);
    if (!route) {
      console.log(`MISSING  ${slug} is not in FIXED_ROUTES`);
      continue;
    }

    const fromKey = ZONE_CODE_TO_KEY[route.from];
    const toKey = ZONE_CODE_TO_KEY[route.to];
    const label = `${route.fromLabel} ⇄ ${route.toLabel}`;
    const category = route.category === "airport-city" ? "airport" : route.category;
    const fares = CODES.map((c) => `${c[0]}${route.prices[c]}`).join(" ");

    // Either the slug or the zone pair already being present means published.
    const existing = await prisma.route.findFirst({
      where: {
        OR: [
          { slug },
          { fromKey, toKey },
          { fromKey: toKey, toKey: fromKey },
        ],
      },
      include: { prices: true },
    });

    if (existing) {
      skipped++;
      console.log(`SKIP     ${label} — already published as "${existing.slug}", left untouched`);
      continue;
    }

    console.log(`CREATE   ${label}  [${category}]  ${fares}`);
    created++;

    if (APPLY) {
      await prisma.route.create({
        data: {
          slug, fromKey, toKey, label, category,
          sortOrder: order++,
          active: true,
          prices: {
            create: CODES.map((vehicleCode) => ({
              vehicleCode,
              price: route.prices[vehicleCode],
              updatedBy: "publish-new-routes",
            })),
          },
        },
      });
    }
  }

  console.log(`\n${created} to create, ${skipped} already published`);
  if (created && APPLY) {
    console.log(
      "\nThe pricing cache is tagged and holds for up to an hour. Bump the\n" +
      'unstable_cache key suffix in lib/pricing-service.ts ("pricing-routes-v2")\n' +
      "or call /api/cron/revalidate-pricing so /pricing picks these up now.",
    );
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
