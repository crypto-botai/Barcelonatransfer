"use client";

import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
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
 *
 * The chosen card is set in the same metal as the pay button: a hairline of
 * gold, a one-pixel light along its top edge, the check drawn in on a spring.
 * Unchosen cards stay quiet so the choice reads at a glance.
 */

const SPRING = { type: "spring", stiffness: 380, damping: 28 } as const;

function Tick({ on, round = false }: { on: boolean; round?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <span className={cn(
      "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center border transition-colors duration-300",
      round ? "rounded-full" : "rounded-md",
      on ? "border-[#8d6f2a] bg-[linear-gradient(180deg,#f3dfa2,#c9a84c)] text-[#120f08] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]" : "border-white/20 bg-black/20",
    )}>
      <AnimatePresence initial={false}>
        {on && (
          <motion.span
            key="tick"
            initial={reduce ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduce ? undefined : { scale: 0.4, opacity: 0 }}
            transition={SPRING}
            className="flex"
          >
            <Check size={13} strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

const cardClass = (on: boolean) => cn(
  "relative isolate w-full text-left rounded-2xl border p-4 transition-[border-color,background-color,box-shadow] duration-300",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]",
  on
    ? "border-[#c9a84c]/70 bg-[linear-gradient(180deg,rgba(201,168,76,0.14),rgba(201,168,76,0.05))] shadow-[inset_0_1px_0_rgba(245,224,169,0.35),0_10px_30px_-18px_rgba(201,168,76,0.6)]"
    : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.18] hover:bg-white/[0.035]",
);

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
  const reduce = useReducedMotion();
  const tap = reduce ? undefined : { scale: 0.99 };

  return (
    <div className="space-y-3">
      {/* Cancellation protection */}
      <motion.button
        type="button"
        role="checkbox"
        aria-checked={protection}
        onClick={() => onProtection(!protection)}
        whileTap={tap}
        transition={SPRING}
        className={cardClass(protection)}
      >
        <div className="flex items-start gap-3">
          <Tick on={protection} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="flex items-center gap-2 text-sm font-medium text-white">
                <ShieldCheck size={15} className={protection ? "text-gold-300" : "text-gold-400"} /> Cancellation protection
              </p>
              <p className={cn("font-display text-base tabular-nums", protection ? "text-gold-300" : "text-gold-400")}>+{formatCurrency(protectionFeeIfTaken)}</p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-dark-400">
              Cancel up to <span className="text-white">{PROTECTION_CUTOFF_HOURS} hours</span> before pickup and the whole fare comes back, instead of the usual {FREE_CANCEL_HOURS} hours.
              The {PROTECTION_PERCENT}% protection fee itself is not refunded.
            </p>
          </div>
        </div>
      </motion.button>

      {/* Pay now, or deposit */}
      {depositAllowed && (
        <div role="radiogroup" aria-label="How would you like to pay?" className="grid gap-2 sm:grid-cols-2">
          {([
            { key: "FULL" as const, Icon: CreditCard, title: "Pay in full now", sub: `${formatCurrency(plan.total)} by card today. Nothing more to pay.` },
            {
              key: "DEPOSIT" as const, Icon: Wallet, title: `Pay ${DEPOSIT_PERCENT}% now, rest to your chauffeur`,
              sub: option === "DEPOSIT"
                ? `${formatCurrency(plan.payNow)} today, then ${formatCurrency(plan.balance)} cash or card on the day.`
                : "A small deposit holds the car. Settle the rest with your chauffeur, cash or card.",
            },
          ]).map(({ key, Icon, title, sub }) => {
            const on = option === key;
            return (
              <motion.button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onOption(key)}
                whileTap={tap}
                transition={SPRING}
                className={cardClass(on)}
              >
                <div className="flex items-start gap-3">
                  <Tick on={on} round />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-white">
                      <Icon size={15} className={on ? "text-gold-300" : "text-dark-400"} /> {title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-dark-400">{sub}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
