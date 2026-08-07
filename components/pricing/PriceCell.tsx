"use client";

import { useCurrency } from "@/components/currency/CurrencyProvider";

interface PriceCellProps {
  amount: number;
  gold?: boolean;
  className?: string;
}

/**
 * A single price in the rates table.
 *
 * The euro figure is always the primary reading, because it is the only one the
 * customer is actually charged. A converted figure appears beneath it as muted,
 * explicitly approximate secondary text — and only when a live ECB rate is
 * available. Outside a CurrencyProvider this renders exactly as it always did.
 */
export default function PriceCell({ amount, gold = false, className = "" }: PriceCellProps) {
  const ctx = useCurrency();
  const converted = ctx && ctx.currency !== "EUR" ? ctx.format(amount).converted : null;

  return (
    <td className={`py-3.5 px-3 text-center ${className}`}>
      <span className={`text-sm ${gold ? "font-semibold text-gold-400" : "font-medium text-white"}`}>
        €{amount}
      </span>
      {converted && (
        <span className="block text-[11px] text-dark-500 tabular-nums">{converted}</span>
      )}
    </td>
  );
}
