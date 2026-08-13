/**
 * Quote every table route against production and compare with FIXED_ROUTES.
 *
 * This is the end-to-end check the earlier drift would have caught: the pages
 * read the table, the checkout reads the database, and for nineteen fares those
 * disagreed while every page still looked correct. Asking the live quote
 * endpoint is the only way to see what a customer is actually charged.
 *
 * Read-only — /api/quote prices a journey, it creates nothing.
 *
 *   npx tsx scripts/verify-live-prices.mts
 *   npx tsx scripts/verify-live-prices.mts https://staging.example.com
 */
import { FIXED_ROUTES } from "../lib/fixed-prices";
import { ZONE_CODE_TO_KEY } from "../lib/pricing";
import { FLEET_TO_DB_CLASS, type FleetVehicle } from "../types";

const ROOT = process.argv[2] ?? "https://www.elitebcn.info";

/** A representative point inside each pricing zone. */
const ZONE_POINT: Record<string, [number, number, string]> = {
  airport:         [41.2871, 2.0785, "Terminal 1, El Prat Airport BCN"],
  barcelona_city:  [41.3874, 2.1686, "Placa de Catalunya, Barcelona city centre"],
  cruise:          [41.3611, 2.1761, "Moll Adossat, cruise terminal port Barcelona"],
  sants:           [41.3794, 2.1401, "Estacio de Sants, Barcelona sants station"],
  montserrat:      [41.5928, 1.8363, "Montserrat Monastery, Monistrol de Montserrat"],
  andorra:         [42.5063, 1.5218, "Andorra la Vella, Andorra"],
  lourdes:         [43.0919, -0.0459, "Lourdes, Hautes-Pyrenees, France"],
  la_roca:         [41.6120, 2.3260, "La Roca Village, La Roca del Valles"],
  girona_airport:  [41.9011, 2.7604, "Girona Costa Brava Airport, Vilobi"],
  girona_city:     [41.9794, 2.8214, "Girona city centre"],
  castelldefels:   [41.2800, 1.9780, "Castelldefels, Baix Llobregat"],
  sitges:          [41.2369, 1.8109, "Sitges, Garraf"],
  vilanova:        [41.2241, 1.7256, "Vilanova i la Geltru, Garraf"],
  cubelles:        [41.2134, 1.6764, "Cubelles, Garraf"],
  calafell:        [41.1977, 1.5675, "Calafell, Baix Penedes"],
  vendrell:        [41.2172, 1.5374, "El Vendrell, Baix Penedes"],
  tarragona:       [41.1189, 1.2445, "Tarragona city centre"],
  la_pineda:       [41.0750, 1.1540, "La Pineda, Vila-seca"],
  salou:           [41.0765, 1.1426, "Salou, Vila-seca"],
  portaventura:    [41.0864, 1.1546, "PortAventura World, Salou"],
  cambrils:        [41.0652, 1.0594, "Cambrils, Baix Camp"],
  reus_airport:    [41.1474, 1.1672, "Reus Airport, Tarragona"],
  mataro:          [41.5388, 2.4450, "Mataro, Maresme"],
  calella:         [41.6175, 2.6575, "Calella, Maresme"],
  pineda_de_mar:   [41.6249, 2.6835, "Pineda de Mar, Maresme"],
  santa_susanna:   [41.6736, 2.7139, "Santa Susanna, Maresme"],
  malgrat:         [41.6475, 2.7477, "Malgrat de Mar, Maresme"],
  blanes:          [41.6747, 2.7897, "Blanes, Selva"],
  lloret:          [41.6993, 2.8469, "Lloret de Mar, Selva"],
  tossa:           [41.7218, 2.9330, "Tossa de Mar, Selva"],
  sagaro:          [41.7870, 3.0450, "S'Agaro, Baix Emporda"],
  platja_daro:     [41.8174, 3.0648, "Platja d'Aro, Baix Emporda"],
  palamos:         [41.8449, 3.1304, "Palamos, Baix Emporda"],
  begur:           [41.9542, 3.2072, "Begur, Baix Emporda"],
  roses:           [42.2688, 3.1760, "Roses, Alt Emporda"],
  empuriabrava:    [42.2494, 3.1166, "Empuriabrava, Alt Emporda"],
  figueres:        [42.2676, 2.9624, "Figueres, Alt Emporda"],
  cadaques:        [42.2882, 3.2787, "Cadaques, Alt Emporda"],
};

// The booking form's classes, and the price column each one reads.
const CLASSES: [string, "ECONOMY" | "BUSINESS" | "MINIVAN" | "VCLASS" | "MINIBUS"][] = [
  ["ECONOMY", "ECONOMY"],
  ["LUXURY", "BUSINESS"],
  ["MINIVAN", "MINIVAN"],
  ["LUXURY_MINIVAN", "VCLASS"],
  ["MINIBUS", "MINIBUS"],
];

async function quote(
  from: string,
  to: string,
  vehicleClass: string,
  fleetVehicle?: string,
): Promise<number | null> {
  const a = ZONE_POINT[from];
  const b = ZONE_POINT[to];
  if (!a || !b) return null;
  const res = await fetch(`${ROOT}/api/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pickupLat: a[0], pickupLng: a[1], pickupAddress: a[2],
      dropoffLat: b[0], dropoffLng: b[1], dropoffAddress: b[2],
      vehicleClass,
      fleetVehicle,
      pickupDatetime: "2026-09-15T10:00",
      passengers: 2,
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return typeof j.totalAmount === "number" ? j.totalAmount : null;
}

async function main() {
  console.log(`Quoting every table route against ${ROOT}\n`);

  let checked = 0;
  let mismatched = 0;
  let unquotable = 0;

  for (const route of FIXED_ROUTES) {
    const from = ZONE_CODE_TO_KEY[route.from];
    const to = ZONE_CODE_TO_KEY[route.to];
    if (!ZONE_POINT[from] || !ZONE_POINT[to]) {
      unquotable++;
      console.log(`  skip  ${route.fromLabel} → ${route.toLabel} (no representative point)`);
      continue;
    }

    for (const [vehicleClass, code] of CLASSES) {
      const expected = route.prices[code];
      const got = await quote(from, to, vehicleClass);
      checked++;
      if (got !== expected) {
        mismatched++;
        console.log(
          `  MISMATCH ${route.fromLabel} → ${route.toLabel}  ${code}  ` +
          `quoted €${got}, table €${expected}`,
        );
      }
    }
  }

  // ── per-car prices ────────────────────────────────────────────────────────
  //
  // The database holds five columns per route and cannot express a per-car
  // price, so these are the quotes most likely to diverge from the page. Every
  // car with an override is asked for directly.
  console.log("\nPer-car prices:");
  for (const route of FIXED_ROUTES) {
    const overrides = Object.entries(route.vehicleOverrides ?? {});
    if (!overrides.length) continue;
    const from = ZONE_CODE_TO_KEY[route.from];
    const to = ZONE_CODE_TO_KEY[route.to];
    if (!ZONE_POINT[from] || !ZONE_POINT[to]) continue;

    for (const [car, expected] of overrides) {
      const cls = FLEET_TO_DB_CLASS[car as FleetVehicle];
      const got = await quote(from, to, cls, car);
      checked++;
      const ok = got === expected;
      if (!ok) mismatched++;
      console.log(
        `  ${ok ? "ok  " : "MISMATCH"} ${route.fromLabel} → ${route.toLabel}  ` +
        `${car.padEnd(9)} quoted €${got}, expected €${expected}`,
      );
    }
  }

  console.log(
    `\n${checked} quotes checked, ${mismatched} mismatched` +
    (unquotable ? `, ${unquotable} routes had no test point` : ""),
  );
  process.exit(mismatched ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
