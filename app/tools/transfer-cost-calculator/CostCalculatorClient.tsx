"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Users, Clock, Star, ExternalLink } from "lucide-react";

interface Destination {
  label: string;
  slug?: string;
  distanceKm: number;
  durationMin: number;
  privateSedan: number;
  privateMpv: number;
  aerobusAvailable: boolean;
  metroAvailable: boolean;
}

const DESTINATIONS: Destination[] = [
  { label: "Barcelona City Centre (Eixample/Las Ramblas)", distanceKm: 16, durationMin: 25, privateSedan: 45, privateMpv: 65, aerobusAvailable: true, metroAvailable: true },
  { label: "W Barcelona Hotel / Barceloneta", slug: "w-barcelona-hotel", distanceKm: 18, durationMin: 25, privateSedan: 45, privateMpv: 65, aerobusAvailable: false, metroAvailable: true },
  { label: "Hotel Arts Barcelona / Pullman Skipper", slug: "hotel-arts-barcelona", distanceKm: 17, durationMin: 22, privateSedan: 45, privateMpv: 65, aerobusAvailable: false, metroAvailable: true },
  { label: "Passeig de Gràcia Hotels (Mandarin, Majestic…)", slug: "mandarin-oriental-barcelona", distanceKm: 16, durationMin: 26, privateSedan: 45, privateMpv: 65, aerobusAvailable: true, metroAvailable: true },
  { label: "Fairmont / Sofia Hotel (Diagonal)", slug: "fairmont-rey-juan-carlos", distanceKm: 12, durationMin: 18, privateSedan: 45, privateMpv: 65, aerobusAvailable: false, metroAvailable: false },
  { label: "Hilton Diagonal Mar / Parc del Fòrum", slug: "hilton-diagonal-mar", distanceKm: 14, durationMin: 20, privateSedan: 45, privateMpv: 65, aerobusAvailable: false, metroAvailable: true },
  { label: "Barcelona Cruise Port (Moll Adossat)", slug: "msc-cruises-barcelona", distanceKm: 14, durationMin: 20, privateSedan: 45, privateMpv: 65, aerobusAvailable: false, metroAvailable: false },
  { label: "Fira Gran Via (MWC / ISE)", slug: "mwc-2027-barcelona", distanceKm: 7, durationMin: 12, privateSedan: 35, privateMpv: 55, aerobusAvailable: false, metroAvailable: true },
  { label: "Castelldefels", slug: "castelldefels", distanceKm: 20, durationMin: 22, privateSedan: 48, privateMpv: 68, aerobusAvailable: false, metroAvailable: false },
  { label: "Sitges", distanceKm: 35, durationMin: 35, privateSedan: 65, privateMpv: 85, aerobusAvailable: false, metroAvailable: false },
  { label: "Mataró", slug: "mataro-transfer", distanceKm: 36, durationMin: 38, privateSedan: 55, privateMpv: 75, aerobusAvailable: false, metroAvailable: false },
  { label: "Terrassa", slug: "terrassa-transfer", distanceKm: 40, durationMin: 42, privateSedan: 60, privateMpv: 85, aerobusAvailable: false, metroAvailable: false },
  { label: "Salou / PortAventura", slug: "salou-transfer", distanceKm: 101, durationMin: 70, privateSedan: 100, privateMpv: 135, aerobusAvailable: false, metroAvailable: false },
  { label: "Reus Airport (REU)", slug: "reus-airport", distanceKm: 112, durationMin: 70, privateSedan: 110, privateMpv: 145, aerobusAvailable: false, metroAvailable: false },
  { label: "Tarragona", distanceKm: 95, durationMin: 65, privateSedan: 95, privateMpv: 130, aerobusAvailable: false, metroAvailable: false },
  { label: "Girona / Costa Brava", distanceKm: 100, durationMin: 65, privateSedan: 110, privateMpv: 145, aerobusAvailable: false, metroAvailable: false },
  { label: "Girona Airport (GRO)", slug: "girona-airport", distanceKm: 103, durationMin: 68, privateSedan: 105, privateMpv: 140, aerobusAvailable: false, metroAvailable: false },
  { label: "Montserrat", distanceKm: 58, durationMin: 50, privateSedan: 85, privateMpv: 110, aerobusAvailable: false, metroAvailable: false },
  { label: "Andorra la Vella", distanceKm: 205, durationMin: 155, privateSedan: 220, privateMpv: 290, aerobusAvailable: false, metroAvailable: false },
  { label: "Perpignan, France", slug: "perpignan-transfer", distanceKm: 188, durationMin: 125, privateSedan: 185, privateMpv: 250, aerobusAvailable: false, metroAvailable: false },
  { label: "Lleida", slug: "lleida-transfer", distanceKm: 172, durationMin: 105, privateSedan: 165, privateMpv: 220, aerobusAvailable: false, metroAvailable: false },
  { label: "Valencia", slug: "valencia-transfer", distanceKm: 355, durationMin: 215, privateSedan: 290, privateMpv: 380, aerobusAvailable: false, metroAvailable: false },
  { label: "Madrid", slug: "madrid-transfer", distanceKm: 628, durationMin: 335, privateSedan: 490, privateMpv: 620, aerobusAvailable: false, metroAvailable: false },
];

type TariffType = "t1" | "t2";

const TAXI = {
  t1: { flagfall: 2.15, perKm: 1.13 },
  t2: { flagfall: 2.90, perKm: 1.30 },
};
const AIRPORT_SUPPLEMENT = 4.50;
const TAXI_MIN_FARE = 8.00;
const AEROBUS_PER_PERSON = 6.75;
const METRO_PER_PERSON = 5.15;

function calcTaxi(distanceKm: number, tariff: TariffType): number {
  const t = TAXI[tariff];
  const raw = t.flagfall + distanceKm * t.perKm + AIRPORT_SUPPLEMENT;
  return Math.max(raw, TAXI_MIN_FARE);
}

function comfortScore(method: string): number {
  if (method === "private") return 5;
  if (method === "taxi") return 3.5;
  if (method === "aerobus") return 2.5;
  return 2;
}

function formatMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function Stars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          className={n <= Math.round(score) ? "text-gold-400 fill-gold-400" : "text-dark-500"}
        />
      ))}
    </div>
  );
}

interface Row {
  method: string;
  label: string;
  costPerVehicle: number | null;
  costPerPerson: number | null;
  totalForGroup: number;
  durationMin: number;
  comfort: number;
  available: boolean;
  note?: string;
  highlight?: boolean;
}

export default function CostCalculatorClient() {
  const [destIndex, setDestIndex] = useState(0);
  const [pax, setPax] = useState(2);
  const [tariff, setTariff] = useState<TariffType>("t1");

  const dest = DESTINATIONS[destIndex];

  const rows: Row[] = useMemo(() => {
    const taxi = calcTaxi(dest.distanceKm, tariff);
    const vehicle = pax <= 3 ? "sedan" : "mpv";
    const privatePrice = pax <= 3 ? dest.privateSedan : dest.privateMpv;

    return [
      {
        method: "private-sedan",
        label: "Private transfer (EQE 300 Electric)",
        costPerVehicle: dest.privateSedan,
        costPerPerson: dest.privateSedan / Math.min(pax, 3),
        totalForGroup: pax <= 3 ? dest.privateSedan : dest.privateMpv,
        durationMin: dest.durationMin,
        comfort: 5,
        available: true,
        highlight: true,
        note: pax > 3 ? `V-Class (7 pax) — €${dest.privateMpv} total` : undefined,
      },
      {
        method: "taxi",
        label: `Metered taxi (${tariff === "t1" ? "T-1 day rate" : "T-2 night/weekend"})`,
        costPerVehicle: taxi,
        costPerPerson: pax <= 4 ? taxi : null,
        totalForGroup: pax <= 4 ? taxi : taxi * Math.ceil(pax / 4),
        durationMin: dest.durationMin + 10,
        comfort: 3.5,
        available: true,
        note: pax > 4 ? `Estimate for ${Math.ceil(pax / 4)} taxis` : "Estimate — meter varies",
      },
      {
        method: "aerobus",
        label: "Aerobus (to Plaça de Catalunya)",
        costPerVehicle: null,
        costPerPerson: AEROBUS_PER_PERSON,
        totalForGroup: dest.aerobusAvailable ? AEROBUS_PER_PERSON * pax : 0,
        durationMin: dest.aerobusAvailable ? 35 + 15 : 0,
        comfort: 2.5,
        available: dest.aerobusAvailable,
        note: dest.aerobusAvailable ? "City centre only — not to your destination" : "Not available for this destination",
      },
      {
        method: "metro",
        label: "Metro L9 Sud (T-Casual card)",
        costPerVehicle: null,
        costPerPerson: METRO_PER_PERSON,
        totalForGroup: dest.metroAvailable ? METRO_PER_PERSON * pax : 0,
        durationMin: dest.metroAvailable ? 40 + 15 : 0,
        comfort: 2,
        available: dest.metroAvailable,
        note: dest.metroAvailable ? "To metro-served areas only — not door-to-door" : "Not available for this destination",
      },
    ];
  }, [dest, pax, tariff]);

  const bestValue = rows
    .filter((r) => r.available)
    .reduce((a, b) => (a.totalForGroup <= b.totalForGroup ? a : b));

  return (
    <section className="py-16 bg-dark-950">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {/* Destination */}
          <div className="sm:col-span-2">
            <label className="block text-xs text-dark-400 uppercase tracking-wider mb-2">Destination</label>
            <select
              value={destIndex}
              onChange={(e) => setDestIndex(Number(e.target.value))}
              className="input-luxury w-full px-4 py-3 rounded-xl text-sm"
            >
              {DESTINATIONS.map((d, i) => (
                <option key={d.label} value={i}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Passengers */}
          <div>
            <label className="block text-xs text-dark-400 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1"><Users size={12} /> Passengers</span>
            </label>
            <div className="flex items-center gap-3 input-luxury px-4 py-3 rounded-xl">
              <button
                onClick={() => setPax((p) => Math.max(1, p - 1))}
                className="w-6 h-6 rounded-full border border-gold-500/30 text-gold-400 hover:bg-gold-500/10 flex items-center justify-center text-lg leading-none"
              >
                −
              </button>
              <span className="text-white font-semibold w-6 text-center">{pax}</span>
              <button
                onClick={() => setPax((p) => Math.min(7, p + 1))}
                className="w-6 h-6 rounded-full border border-gold-500/30 text-gold-400 hover:bg-gold-500/10 flex items-center justify-center text-lg leading-none"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Tariff toggle */}
        <div className="flex items-center gap-3 mb-8 text-sm">
          <span className="text-dark-400">Taxi tariff:</span>
          <button
            onClick={() => setTariff("t1")}
            className={`px-4 py-1.5 rounded-lg border transition-colors ${tariff === "t1" ? "border-gold-500/60 bg-gold-500/10 text-gold-400" : "border-white/10 text-dark-400 hover:border-white/20"}`}
          >
            T-1 Day (Mon–Fri 08:00–21:59)
          </button>
          <button
            onClick={() => setTariff("t2")}
            className={`px-4 py-1.5 rounded-lg border transition-colors ${tariff === "t2" ? "border-gold-500/60 bg-gold-500/10 text-gold-400" : "border-white/10 text-dark-400 hover:border-white/20"}`}
          >
            T-2 Night/Weekend
          </button>
        </div>

        {/* Route summary */}
        <div className="bg-dark-900 border border-white/[0.08] rounded-xl p-5 mb-6 flex flex-wrap gap-6 items-center">
          <div>
            <p className="text-dark-400 text-xs uppercase tracking-wider">Route</p>
            <p className="text-white font-medium">BCN Airport → {dest.label}</p>
          </div>
          <div>
            <p className="text-dark-400 text-xs uppercase tracking-wider">Distance</p>
            <p className="text-white font-medium">{dest.distanceKm} km</p>
          </div>
          <div>
            <p className="text-dark-400 text-xs uppercase tracking-wider">Journey time</p>
            <p className="text-white font-medium flex items-center gap-1"><Clock size={14} className="text-gold-500" />{formatMin(dest.durationMin)}</p>
          </div>
          <div>
            <p className="text-dark-400 text-xs uppercase tracking-wider">Passengers</p>
            <p className="text-white font-medium">{pax}</p>
          </div>
        </div>

        {/* Comparison table */}
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.method}
              className={`rounded-xl border p-5 transition-all ${
                !row.available
                  ? "border-white/[0.04] bg-dark-900/40 opacity-50"
                  : row.highlight
                  ? "border-gold-500/40 bg-gold-500/5"
                  : "border-white/[0.08] bg-dark-900"
              }`}
            >
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold ${row.available ? "text-white" : "text-dark-500"}`}>
                      {row.label}
                    </p>
                    {row.method === "private-sedan" && (
                      <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs font-medium">Recommended</span>
                    )}
                    {row.available && row === bestValue && row.method !== "private-sedan" && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">Cheapest</span>
                    )}
                  </div>
                  {row.note && (
                    <p className="text-dark-500 text-xs mt-0.5">{row.note}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <Stars score={row.comfort} />
                    <span className="text-dark-500 text-xs">comfort</span>
                    {row.available && (
                      <>
                        <span className="text-dark-500 text-xs">·</span>
                        <span className="text-dark-400 text-xs flex items-center gap-1">
                          <Clock size={11} /> {formatMin(row.durationMin)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {row.available ? (
                    <>
                      <p className="text-gold-400 text-2xl font-bold">
                        €{row.totalForGroup.toFixed(0)}
                      </p>
                      <p className="text-dark-400 text-xs">
                        {row.costPerVehicle !== null
                          ? `total (${pax} pax)`
                          : `€${(row.totalForGroup / pax).toFixed(2)}/person`}
                      </p>
                    </>
                  ) : (
                    <p className="text-dark-500 text-sm">Not available</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Per-person breakdown */}
        <div className="mt-8 bg-dark-900 border border-white/[0.08] rounded-xl p-5">
          {/* h2, not h3: this is the first heading under the page's h1, and
              as an h3 it skipped a level. */}
          <h2 className="text-white font-semibold mb-4">Per-person cost breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-dark-400 font-normal py-2 pr-4">Option</th>
                  {[1, 2, 3, 4, 6, 7].map((n) => (
                    <th key={n} className={`text-right text-dark-400 font-normal py-2 px-2 ${n === pax ? "text-gold-400" : ""}`}>
                      {n} pax
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Private EQE 300", prices: [1,2,3,4,6,7].map((n) => dest.privateSedan / Math.min(n, 4)) },
                  { label: "Private V-Class", prices: [1,2,3,4,6,7].map((n) => dest.privateMpv / n) },
                  { label: `Taxi (${tariff.toUpperCase()})`, prices: [1,2,3,4,6,7].map((n) => calcTaxi(dest.distanceKm, tariff) * Math.ceil(n / 4) / n) },
                  ...(dest.aerobusAvailable ? [{ label: "Aerobus", prices: [1,2,3,4,6,7].map(() => AEROBUS_PER_PERSON) }] : []),
                  ...(dest.metroAvailable ? [{ label: "Metro", prices: [1,2,3,4,6,7].map(() => METRO_PER_PERSON) }] : []),
                ].map(({ label, prices }) => (
                  <tr key={label} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2 pr-4 text-dark-300">{label}</td>
                    {prices.map((p, i) => {
                      const n = [1,2,3,4,6,7][i];
                      return (
                        <td key={n} className={`text-right py-2 px-2 ${n === pax ? "text-gold-400 font-semibold" : "text-dark-400"}`}>
                          €{p.toFixed(0)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Book CTA */}
        <div className="mt-8 text-center">
          <p className="text-dark-400 text-sm mb-4">
            Elite BCN private transfer: fixed price, meet & greet in arrivals, flight tracking, no surge pricing.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href={`/book?destination=${encodeURIComponent(dest.label)}`}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-950 font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Book Private Transfer — €{pax <= 3 ? dest.privateSedan : dest.privateMpv}
            </Link>
            {dest.slug && (
              <Link
                href={`/transfers/${dest.slug}`}
                className="inline-flex items-center gap-2 border border-gold-500/30 text-gold-400 hover:border-gold-500/60 px-8 py-3 rounded-lg transition-colors text-sm"
              >
                More about this route <ExternalLink size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
