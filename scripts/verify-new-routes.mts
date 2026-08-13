/**
 * Sanity check for the four destinations added on 13 Aug 2026.
 *
 * Confirms that a free-text address a customer would actually type resolves to
 * the new zone, and that the zone returns the table fare rather than falling
 * through to the per-km estimate — which is the failure mode that once quoted
 * €399 for a Girona journey the site advertised at €140.
 */
import { resolveZone, lookupFixedPriceByZone } from "../lib/pricing";

const CASES: Array<[string, string, number]> = [
  // typed address                              zone            economy from city
  ["Girona", "girona_city", 140],
  ["Girona, Gironès, Girona, Catalunya, Spain", "girona_city", 140],
  ["Begur, Baix Empordà, Girona, Catalunya", "begur", 200],
  ["Aiguablava, Begur", "begur", 200],
  ["Hotel Aiguablava, Platja de Fornells", "begur", 200],
  ["Vilanova i la Geltrú, Garraf, Barcelona", "vilanova", 85],
  ["Reus Airport", "reus_airport", 155],
  ["Aeroport de Reus (REU)", "reus_airport", 155],
  // regression: neighbours must not be dragged onto the new zones
  ["Palamós, Baix Empordà, Girona", "palamos", 185],
  ["Sitges, Garraf, Barcelona", "sitges", 80],
  ["Salou, Tarragonès, Tarragona", "salou", 155],
  ["Cambrils, Baix Camp, Tarragona", "cambrils", 160],
  ["Girona Airport, Vilobí d'Onyar", "girona_airport", 140],
];

let bad = 0;
for (const [input, wantZone, wantFare] of CASES) {
  const zone = resolveZone(input);
  const fare = zone ? lookupFixedPriceByZone("barcelona_city", zone, "ECONOMY") : null;
  const ok = zone === wantZone && fare === wantFare;
  if (!ok) bad++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${input.padEnd(44)} -> ${String(zone).padEnd(15)} €${fare}` +
      (ok ? "" : `   expected ${wantZone} €${wantFare}`),
  );
}

console.log(bad ? `\n${bad} failed` : "\nall resolve to the table price");
process.exit(bad ? 1 : 0);
