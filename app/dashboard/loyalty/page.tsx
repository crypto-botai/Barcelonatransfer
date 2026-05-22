"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, Gift, ChevronRight, Crown, Zap, Check, ArrowUpRight } from "lucide-react";

interface LoyaltyData {
  totalSpent: number;
  loyaltyPoints: number;
  memberTier: string;
  completedCount: number;
  totalBookings: number;
}

const TIERS = [
  {
    id: "Silver",
    label: "Silver",
    threshold: 0,
    icon: "⚡",
    color: "from-slate-400/10 to-transparent",
    border: "border-slate-400/20",
    textColor: "text-slate-300",
    perks: ["Priority support", "1% cashback points", "Birthday discount"],
  },
  {
    id: "Gold",
    label: "Gold",
    threshold: 500,
    icon: "⭐",
    color: "from-gold-500/15 to-transparent",
    border: "border-gold-500/30",
    textColor: "text-gold-400",
    perks: ["Priority booking", "2% cashback points", "Free meet & greet upgrade", "Dedicated phone line", "Birthday discount 10%"],
  },
  {
    id: "VIP",
    label: "VIP Elite",
    threshold: 2000,
    icon: "👑",
    color: "from-purple-500/15 to-transparent",
    border: "border-purple-500/30",
    textColor: "text-purple-300",
    perks: ["Dedicated concierge 24/7", "5% cashback points", "Complimentary upgrades", "VIP lounge access", "Priority dispatch", "Annual luxury gift"],
  },
];

export default function LoyaltyPage() {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/stats").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  const currentTier = TIERS.find(t => t.id === data?.memberTier) ?? TIERS[1];
  const nextTier = TIERS[TIERS.indexOf(currentTier) + 1];
  const toNextTier = nextTier ? Math.max(0, nextTier.threshold - (data?.totalSpent ?? 0)) : 0;
  const progressPct = nextTier ? Math.min(100, ((data?.totalSpent ?? 0) / nextTier.threshold) * 100) : 100;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">

      {/* Current membership card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative rounded-2xl overflow-hidden border ${currentTier.border} bg-gradient-to-br ${currentTier.color} bg-dark-900 p-6`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_20%,rgba(201,168,76,0.08),transparent)]" />
        <div className="relative">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-dark-400 text-[10px] uppercase tracking-widest mb-2">Your Membership</p>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-3xl">{currentTier.icon}</span>
                <div>
                  <h2 className={`font-display text-2xl ${currentTier.textColor}`}>{currentTier.label}</h2>
                  <p className="text-dark-400 text-sm">Elite Club Member</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`font-display text-4xl ${currentTier.textColor}`}>{data?.loyaltyPoints.toLocaleString() ?? "—"}</span>
                <span className="text-dark-400 text-sm">points</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-dark-400 text-xs mb-1">Total Spent</p>
              <p className="font-display text-2xl text-white">€{data?.totalSpent.toFixed(0) ?? "—"}</p>
              <p className="text-dark-500 text-xs mt-1">{data?.completedCount ?? 0} rides completed</p>
            </div>
          </div>

          {/* Progress to next tier */}
          {nextTier && (
            <div className="mt-5 pt-5 border-t border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-dark-400 text-xs">Progress to {nextTier.label}</span>
                <span className={`text-xs font-medium ${currentTier.textColor}`}>
                  €{toNextTier.toFixed(0)} more to spend
                </span>
              </div>
              <div className="h-2 rounded-full bg-dark-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400"
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-dark-600 text-[10px]">€{data?.totalSpent.toFixed(0)}</span>
                <span className="text-dark-600 text-[10px]">€{nextTier.threshold}</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Points redemption */}
      <div className="glass-card rounded-2xl p-5 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Redeem Points</h3>
          <span className="text-gold-400 text-sm font-semibold">{data?.loyaltyPoints.toLocaleString() ?? "—"} pts</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { points: 200, reward: "€10 discount", desc: "Applied on next booking" },
            { points: 500, reward: "€25 discount", desc: "Applied on next booking" },
            { points: 1000, reward: "Free upgrade", desc: "Vehicle class upgrade" },
          ].map(({ points, reward, desc }) => (
            <div key={points} className="bg-dark-800/50 border border-white/[0.06] rounded-xl p-4">
              <p className="text-gold-400 font-semibold mb-0.5">{reward}</p>
              <p className="text-dark-400 text-xs mb-3">{desc}</p>
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-medium">{points} pts</span>
                <button
                  disabled={(data?.loyaltyPoints ?? 0) < points}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gold-500/10 border border-gold-500/20 text-gold-400 hover:bg-gold-500/15 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Redeem
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier comparison */}
      <div>
        <h3 className="text-white font-semibold mb-3">Membership Tiers</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TIERS.map(tier => {
            const isActive = tier.id === data?.memberTier;
            return (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative rounded-2xl overflow-hidden border bg-gradient-to-br ${tier.color} bg-dark-900 p-5 ${isActive ? `${tier.border} ring-1 ring-offset-0 ring-${tier.border}` : "border-white/[0.06]"}`}
              >
                {isActive && (
                  <div className="absolute top-3 right-3 bg-gold-500/20 border border-gold-500/30 rounded-full px-2 py-0.5">
                    <span className="text-gold-400 text-[10px] font-semibold uppercase tracking-wider">Current</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">{tier.icon}</span>
                  <div>
                    <p className={`font-semibold ${tier.textColor}`}>{tier.label}</p>
                    <p className="text-dark-500 text-xs">{tier.threshold === 0 ? "Starting tier" : `From €${tier.threshold} spent`}</p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {tier.perks.map(perk => (
                    <li key={perk} className="flex items-start gap-2 text-xs text-dark-300">
                      <Check size={11} className={`${tier.textColor} flex-shrink-0 mt-0.5`} />
                      {perk}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Refer & earn */}
      <div className="rounded-2xl bg-gradient-to-br from-dark-800 to-dark-900 border border-gold-500/20 p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
          <Gift size={22} className="text-gold-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold mb-1">Earn More Points — Refer Friends</h3>
          <p className="text-dark-400 text-sm">Earn 200 bonus points (worth €10) for every friend you refer who completes their first booking.</p>
          <Link href="/dashboard/refer" className="inline-flex items-center gap-1.5 mt-3 text-gold-400 hover:text-gold-300 text-sm font-medium transition-colors">
            Get my referral link <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
