import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveZone } from "@/lib/pricing";
import { ladderFor } from "@/lib/destination-pricing";
import { FARES_CHECKED_ON, TAXI, AEROBUS, METRO } from "@/lib/competing-fares";

/**
 * The cost calculator compares our fare with a taxi, the Aerobús, the metro and
 * the train. It is the one page whose whole purpose is a price comparison, so
 * a wrong number on it is not a typo, it is the page doing the opposite of its
 * job.
 *
 * Two things went wrong at once. Our own fares were typed into the component
 * and left: fourteen of twenty-three destinations showed less than the
 * checkout charged, Andorra by 130 euros. And the third-party fares were a
 * tariff year stale, with a metro line that told people to use a card the
 * airport stations do not accept. These guard both.
 */
const ROOT = process.cwd();
const CLIENT = readFileSync(join(ROOT, "app", "tools", "transfer-cost-calculator", "CostCalculatorClient.tsx"), "utf-8");
const PAGE = readFileSync(join(ROOT, "app", "tools", "transfer-cost-calculator", "page.tsx"), "utf-8");

type Entry = { label: string; zone?: string; estimateSedan: number; estimateMpv: number };

function entries(): Entry[] {
  const out: Entry[] = [];
  const re = /\{ label: "([^"]+)"(.*?)estimateSedan: (\d+), estimateMpv: (\d+)/g;
  for (const m of CLIENT.matchAll(re)) {
    const zone = m[2].match(/zone: "([^"]+)"/)?.[1];
    out.push({ label: m[1], zone, estimateSedan: +m[3], estimateMpv: +m[4] });
  }
  return out;
}

describe("the calculator's own fares", () => {
  it("still lists every destination", () => {
    expect(entries().length).toBe(23);
  });

  it("reads a table-backed destination from the table, never from a typed number", () => {
    // The component resolves exactly as this does: an explicit zone, else the
    // label. Anything that resolves must have a ladder, or it would fall back
    // to the estimate without saying so.
    for (const e of entries()) {
      const zone = e.zone ?? resolveZone(e.label);
      if (!zone) continue;
      const ladder = ladderFor(zone, "airport");
      expect(ladder, `${e.label} resolves to "${zone}" but the table has no airport row for it`).not.toBeNull();
    }
  });

  it("no longer reads the hardcoded fields anywhere in the render", () => {
    expect(CLIENT).not.toMatch(/dest\.private(Sedan|Mpv)/);
    expect(CLIENT).not.toMatch(/privateSedan|privateMpv/);
    expect(CLIENT).toContain("function companyFares");
    expect(CLIENT).toContain('ladderFor(zone, "airport")');
  });

  it("covers the destinations that were furthest wrong", () => {
    // The three worst understatements found on 12 Sep 2026. If any stops
    // resolving, the estimate would quietly come back.
    for (const [label, zone] of [["Andorra la Vella", "andorra"], ["Girona Airport (GRO)", "girona_airport"], ["Salou / PortAventura", "portaventura"]]) {
      expect(resolveZone(label), label).toBe(zone);
      expect(ladderFor(zone, "airport")).not.toBeNull();
    }
  });

  it("names the hotel entries' zone, since a hotel name is not a zone", () => {
    for (const e of entries().filter((x) => /Hotel|Fairmont|Hilton|Mandarin/.test(x.label))) {
      expect(e.zone ?? resolveZone(e.label), e.label).toBeTruthy();
    }
  });
});

describe("third-party fares", () => {
  it("were checked within the last year", () => {
    // These are set annually. A comparison a year stale is our page quoting
    // somebody else's old price with our name on it.
    const age = (Date.now() - new Date(FARES_CHECKED_ON).getTime()) / 86_400_000;
    expect(age, `FARES_CHECKED_ON is ${Math.round(age)} days old; re-verify lib/competing-fares.ts`).toBeLessThan(365);
  });

  it("do not tell anyone to use a T-casual at the airport", () => {
    expect(METRO.tCasualValidAtAirport).toBe(false);
    expect(CLIENT).not.toContain("T-Casual card");
    expect(PAGE).not.toMatch(/T-Casual 10-trip/);
  });

  it("are read from the module by both the calculator and the explanation", () => {
    for (const src of [CLIENT, PAGE]) {
      expect(src).toContain('from "@/lib/competing-fares"');
    }
    // No competitor euro figure is typed into either file any more.
    expect(PAGE).not.toMatch(/€\d+\.\d\d/);
    expect(CLIENT).not.toMatch(/(flagfall|perKm|AIRPORT_SUPPLEMENT|_PER_PERSON)\s*[:=]\s*\d/);
  });

  it("carry the 2026 metropolitan taxi tariff", () => {
    expect(TAXI.t1).toMatchObject({ flagfall: 2.8, perKm: 1.35 });
    expect(TAXI.t2).toMatchObject({ flagfall: 2.8, perKm: 1.66 });
    expect(TAXI.airportSupplement).toBe(4.6);
    expect(TAXI.airportToCruiseFixed).toBe(46);
    expect(AEROBUS.single).toBe(7.45);
    expect(METRO.airportTicket).toBe(5.9);
  });
});
