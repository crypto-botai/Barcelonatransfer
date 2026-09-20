"use client";

import { ShieldCheck, Wallet, CreditCard, Check } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  DEPOSIT_PERCENT, PROTECTION_PERCENT, PROTECTION_CUTOFF_HOURS, FREE_CANCEL_HOURS,
  type PayOption, type PaymentPlan,
} from "@/lib/checkout-money";

/**
 * The two choices at the checkout: cancellation protection, and whether to
 * pay everything now or 30% now and the rest to the chauffeur.
 *
 * Both are opt-in and both are plain: what it costs, what it buys, what is
 * left to pay and to whom. The figures come from the same paymentPlan() the
 * server uses, so the button below says exactly what the card is charged.
 */
export default function PaymentOptions({
  plan, protection, option, protectionFeeIfTaken, depositAllowed, onProtection, onOption,
}: {
  plan: PaymentPlan;
  protection: boolean;
  option: PayOption;
  /** What protection would cost, so the toggle can say so before it is on. */
  protectionFeeIfTaken: number;
  /** False on a round trip, which is always paid in full. */
  depositAllowed: boolean;
  onProtection: (on: boolean) => void;
  onOption: (o: PayOption) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Cancellation protection */}
      <button
        type="button"
        role="checkbox"
        aria-checked={protection}
        onClick={() => onProtection(!protection)}
        className={cn(
          "w-full text-left rounded-2xl border p-4 transition-all",
          protection ? "border-gold-500/50 bg-gold-500/[0.07]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]",
        )}
      >
        <div className="flex items-start gap-3">
          <span className={cn(
            "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border",
            protection ? "border-gold-400 bg-gold-500 text-black" : "border-white/20",
          )}>
            {protection && <Check size={13} strokeWidth={3} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="flex items-center gap-2 text-sm font-medium text-white">
                <ShieldCheck size={15} className="text-gold-400" /> Cancellation protection
              </p>
              <p className="text-sm text-gold-400">+{formatCurrency(protectionFeeIfTaken)}</p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-dark-400">
              Cancel up to <span className="text-white">{PROTECTION_CUTOFF_HOURS} hours</span> before pickup and the whole fare comes back — instead of the usual {FREE_CANCEL_HOURS} hours.
              The {PROTECTION_PERCENT}% protection fee itself is not refunded.
            </p>
          </div>
        </div>
      </button>

      {/* Pay now, or deposit */}
      {depositAllowed && (
        <div role="radiogroup" aria-label="How would you like to pay?" className="grid gap-2 sm:grid-cols-2">
          {([
            { key: "FULL" as const, Icon: CreditCard, title: "Pay in full now", sub: `${formatCurrency(plan.total)} by card today. Nothing more to pay.` },
            {
              key: "DEPOSIT" as const, Icon: Wallet, title: `Pay ${DEPOSIT_PERCENT}% now, rest to your chauffeur`,
              sub: option === "DEPOSIT"
                ? `${formatCurrency(plan.payNow)} today · ${formatCurrency(plan.balance)} cash or card on the day.`
                : "A small deposit holds the car. Settle the rest with your chauffeur, cash or card.",
            },
          ]).map(({ key, Icon, title, sub }) => {
            const on = option === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onOption(key)}
                className={cn(
                  "text-left rounded-2xl border p-4 transition-all",
                  on ? "border-gold-500/50 bg-gold-500/[0.07]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]",
                )}
              >
                <p className="flex items-center gap-2 text-sm font-medium text-white">
                  <Icon size={15} className={on ? "text-gold-400" : "text-dark-400"} /> {title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-dark-400">{sub}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
