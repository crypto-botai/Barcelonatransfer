"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ScrollText, ChevronDown } from "lucide-react";
import { CHECKOUT_POLICY_POINTS } from "@/lib/policies";

/**
 * The terms a customer is actually agreeing to, at the moment they agree.
 *
 * Five lines, closed by default so it does not push the pay button down the
 * page, and one tap from the full policy. The same five lines go out in the
 * confirmation email, so nobody can arrive at the airport having been told
 * something different from what they read at the checkout.
 */
export default function PolicySummary({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-[13px] text-white">
          <ScrollText size={14} className="text-gold-400" />
          Before you pay: cancellation, meet &amp; greet, child seats
        </span>
        <ChevronDown size={15} className={`flex-shrink-0 text-dark-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul className="space-y-2 px-4 pb-4 text-[12px] leading-relaxed text-dark-300">
              {CHECKOUT_POLICY_POINTS.map((p) => (
                <li key={p} className="flex gap-2">
                  <span aria-hidden className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-gold-500/70" />
                  {p}
                </li>
              ))}
              <li className="pt-1 text-dark-400">
                Full detail:{" "}
                <Link href="/refund-policy" className="text-gold-400 underline-offset-4 hover:underline">refund and cancellation policy</Link>
                {" · "}
                <Link href="/terms" className="text-gold-400 underline-offset-4 hover:underline">terms and conditions</Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
