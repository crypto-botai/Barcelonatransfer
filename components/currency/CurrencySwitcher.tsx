"use client";

import { DISPLAY_CURRENCIES, CURRENCY_LABELS } from "@/lib/currency";
import { useCurrency } from "./CurrencyProvider";

/**
 * Display-currency toggle.
 *
 * Renders nothing when no rate table reached the client: a switcher that
 * silently leaves prices in euros looks broken, and inventing a rate to keep it
 * populated would be worse.
 */
export default function CurrencySwitcher() {
  const ctx = useCurrency();
  if (!ctx || !ctx.table) return null;

  const { currency, setCurrency, table } = ctx;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div
        role="group"
        aria-label="Display currency"
        className="inline-flex rounded-lg border border-white/[0.08] p-0.5"
      >
        {DISPLAY_CURRENCIES.map((c) => {
          const active = c === currency;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              aria-pressed={active}
              title={CURRENCY_LABELS[c]}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                active
                  ? "bg-gold-500/15 text-gold-300"
                  : "text-dark-400 hover:text-white"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {currency !== "EUR" && (
        <p className="text-dark-500 text-[11px] leading-snug">
          Approximate, for guidance only. You are charged in euros.
          <span className="hidden sm:inline"> ECB reference rate, {table.date}.</span>
        </p>
      )}
    </div>
  );
}
