/**
 * Display-currency conversion and formatting.
 *
 * The one rule this module exists to enforce: a converted figure is always
 * approximate and always accompanied by the EUR amount that will actually be
 * charged. Nothing here should ever be fed back into pricing, invoicing, or
 * the SumUp checkout — those stay in EUR end to end.
 */

import {
  type DisplayCurrency,
  type RateTable,
  DISPLAY_CURRENCIES,
  isDisplayCurrency,
} from "./rates";

export * from "./rates";

const SYMBOLS: Record<DisplayCurrency, string> = { EUR: "€", GBP: "£", USD: "$" };

export const CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  EUR: "Euro",
  GBP: "British pound",
  USD: "US dollar",
};

/**
 * Converts a EUR amount for display.
 *
 * Returns null when no rate is available for the target — the caller must then
 * show the EUR price unchanged rather than substituting a guess.
 */
export function convertFromEur(
  amountEur: number,
  to: DisplayCurrency,
  table: RateTable | null,
): number | null {
  if (to === "EUR") return amountEur;
  const rate = table?.rates[to];
  if (!rate || !Number.isFinite(rate)) return null;
  return amountEur * rate;
}

/**
 * Formats for display. Converted amounts round to a whole unit — showing
 * "£43.71" implies a precision the ECB daily rate does not have, and implies
 * that is the sum that will leave the customer's account, which it is not.
 */
export function formatMoney(amount: number, currency: DisplayCurrency, approx = false): string {
  const symbol = SYMBOLS[currency];
  const rounded = approx ? Math.round(amount) : amount;
  const body =
    Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(2);
  return `${approx ? "≈" : ""}${symbol}${body}`;
}

export interface DisplayPrice {
  /** Always present: what the customer is actually charged. */
  eur: string;
  /** Present only when a rate existed and the target is not EUR. */
  converted: string | null;
  currency: DisplayCurrency;
}

/** Convenience for the price tables: one EUR figure in, both renderings out. */
export function displayPrice(
  amountEur: number,
  currency: DisplayCurrency,
  table: RateTable | null,
): DisplayPrice {
  const eur = formatMoney(amountEur, "EUR");
  if (currency === "EUR") return { eur, converted: null, currency };

  const value = convertFromEur(amountEur, currency, table);
  return {
    eur,
    converted: value === null ? null : formatMoney(value, currency, true),
    currency,
  };
}

/** Narrows an arbitrary string (cookie, query param) to a supported currency. */
export function resolveDisplayCurrency(input?: string | null): DisplayCurrency {
  const up = (input ?? "").toUpperCase();
  return isDisplayCurrency(up) ? up : "EUR";
}

export { DISPLAY_CURRENCIES };
