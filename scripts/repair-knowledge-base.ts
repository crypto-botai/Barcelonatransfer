/**
 * Removes route fares from the AI knowledge base.
 *
 * The support agent's prompt already injects a LIVE PRICING block read from the
 * route table, and instructs the model to quote only from it. The knowledge
 * base was also carrying fares, written once and never updated: eight of the
 * ten figures stored had drifted below what the checkout charges — Montserrat
 * at €85 against €110, the cruise port at €45 against €60, Andorra at €280
 * against €300.
 *
 * Re-synchronising those numbers would fix today and break again at the next
 * repricing, because it would leave two places where a fare lives. So the
 * fares come out entirely. The answers keep everything that is durably true —
 * journey times, vehicle capacities, what the service includes — and the price
 * comes from the live block.
 *
 * Idempotent: rows already free of fares are left untouched.
 *
 *   npx tsx --env-file=.env.local scripts/repair-knowledge-base.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/repair-knowledge-base.ts --apply  # write
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** question fragment → the answer that replaces it, carrying no fare. */
const REWRITES: { match: string; answer: string }[] = [
  {
    match: "hourly hire",
    answer:
      "Yes. Hourly hire books the car and driver for a block of time rather than a single journey, with a " +
      "four-hour minimum. It suits city tours, a day of meetings, or shopping trips where you want the same " +
      "driver waiting between stops. Rates depend on the vehicle and are shown live on elitebcn.info/hourly. " +
      "A 20% night surcharge applies to hourly hire between 22:00 and 06:00; fixed-price transfers have none.",
  },
  {
    match: "price to Andorra",
    answer:
      "Yes, we drive Barcelona and BCN Airport to Andorra la Vella, Encamp and the other parishes, all at the " +
      "same fixed fare. The journey is around three hours. The ski stations — Grandvalira, Pas de la Casa, " +
      "Vallnord — sit further up the valley and are quoted by distance rather than at the Andorra fare. " +
      "Current prices are in the live pricing list.",
  },
  {
    match: "airport to Montserrat",
    answer:
      "Yes. A private transfer from Barcelona Airport to the monastery at Montserrat takes approximately 50 " +
      "minutes, and the price is fixed per vehicle. The current fare is in the live pricing list.",
  },
  {
    match: "price to Sitges",
    answer:
      "Yes. Sitges is about 35 minutes from Barcelona Airport and the fare is fixed per vehicle, the same " +
      "whether you travel from the airport or from the city. Larger vehicles cost more than a sedan; the " +
      "current figures are in the live pricing list. Prices exclude VAT and tolls.",
  },
  {
    match: "airport to the city centre",
    answer:
      "Yes, this is our most common journey — Barcelona Airport, Terminal 1 or Terminal 2, to any city address. " +
      "The price is fixed per vehicle with no surge pricing, and the current figures are in the live pricing " +
      "list. Meet & greet in arrivals and 60 minutes of free waiting from landing are included.",
  },
  {
    match: "price to Tarragona",
    answer:
      "Yes. Tarragona is about an hour from Barcelona or the airport, and the fare is fixed per vehicle. " +
      "The same journey covers Salou, La Pineda and PortAventura. Current prices are in the live pricing list.",
  },
  {
    match: "transfers from the cruise port",
    answer:
      "Yes. We serve every Barcelona cruise terminal — the World Trade Centre quays and Moll Adossat. Tell us " +
      "the ship and terminal when booking and the driver meets you at that quay. Fares are fixed per vehicle " +
      "and differ slightly between an airport pickup and a city hotel; both are in the live pricing list.",
  },
];

async function main() {
  const rows = await prisma.knowledgeBase.findMany();
  const priced = rows.filter((r) => /€\s?\d/.test(r.answer) || /€\s?\d/.test(r.question));

  console.log(`knowledge_base rows: ${rows.length}   carrying a fare: ${priced.length}`);
  console.log(APPLY ? "\nAPPLYING\n" : "\nDRY RUN — pass --apply to write\n");

  let changed = 0;
  let unmatched = 0;

  for (const row of priced) {
    const rule = REWRITES.find((r) => row.question.toLowerCase().includes(r.match.toLowerCase()));
    if (!rule) {
      unmatched++;
      console.log(`  UNMATCHED  [${row.category}] ${row.question}`);
      console.log(`             ${row.answer.replace(/\s+/g, " ").slice(0, 120)}`);
      continue;
    }
    const fares = [...row.answer.matchAll(/€\s?([\d.,]+)/g)].map((m) => m[1]).join(", ");
    console.log(`  ${row.question.slice(0, 62)}`);
    console.log(`     removes fares: ${fares}`);
    if (APPLY) {
      await prisma.knowledgeBase.update({ where: { id: row.id }, data: { answer: rule.answer } });
    }
    changed++;
  }

  console.log(`\n${APPLY ? "updated" : "would update"}: ${changed}   unmatched: ${unmatched}`);

  if (APPLY) {
    const left = (await prisma.knowledgeBase.findMany()).filter((r) => /€\s?\d/.test(r.answer));
    console.log(`rows still carrying a fare after the run: ${left.length}`);
    for (const r of left) console.log(`   [${r.category}] ${r.question}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
