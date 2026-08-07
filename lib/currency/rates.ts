/**
 * Foreign-exchange rates for *display only*.
 *
 * Every booking is charged in EUR by SumUp. These rates exist so a British or
 * American visitor can see roughly what a transfer costs in money they think
 * in — they are never used to compute what the customer is actually charged.
 *
 * Source is the European Central Bank daily reference rates: free, no API key,
 * no account, no rate limit worth worrying about, and authoritative enough that
 * quoting it by name in the UI is meaningful.
 *
 * If the feed cannot be reached we return null and the UI falls back to EUR
 * only. A stale or invented rate displayed next to a price is worse than no
 * conversion at all — it is the kind of thing that turns into a chargeback
 * argument.
 */

import { unstable_cache } from "next/cache";

const ECB_DAILY = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

/** Currencies offered in the switcher. EUR is the base and always present. */
export const DISPLAY_CURRENCIES = ["EUR", "GBP", "USD"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export interface RateTable {
  base: "EUR";
  /** Units of the currency per 1 EUR. Always contains EUR: 1. */
  rates: Record<string, number>;
  /** ECB publication date, YYYY-MM-DD. Shown in the UI so the quote is dated. */
  date: string;
}

export function isDisplayCurrency(v: string): v is DisplayCurrency {
  return (DISPLAY_CURRENCIES as readonly string[]).includes(v);
}

/**
 * Parses the ECB envelope. Deliberately regex-based rather than pulling in an
 * XML parser: the document is a flat, stable list of `<Cube currency= rate=/>`
 * elements and has been for two decades.
 */
export function parseEcbXml(xml: string): RateTable | null {
  const date = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  if (!date) return null;

  const rates: Record<string, number> = { EUR: 1 };
  for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) {
    const value = Number(m[2]);
    if (Number.isFinite(value) && value > 0) rates[m[1]] = value;
  }

  // A payload that parsed but carries no usable rate is a failure, not an
  // empty-but-valid table.
  return Object.keys(rates).length > 1 ? { base: "EUR", rates, date } : null;
}

async function fetchRates(): Promise<RateTable | null> {
  try {
    const res = await fetch(ECB_DAILY, {
      headers: { "User-Agent": "elitebcn.info currency display" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return parseEcbXml(await res.text());
  } catch (e) {
    console.warn("[currency] ECB fetch failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Cached for 12 hours. The ECB publishes once per working day around 16:00 CET,
 * so this is already fresher than the underlying data changes.
 */
export const getRates = unstable_cache(fetchRates, ["ecb-fx-rates"], {
  revalidate: 43_200,
  tags: ["currency"],
});
