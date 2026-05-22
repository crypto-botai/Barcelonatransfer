"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar, Clock, CheckCircle2, Wallet, Star, Gift,
  Plane, ChevronRight, ArrowUpRight, Sparkles, MapPin, Car
} from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import UpcomingBookingCard from "@/components/dashboard/UpcomingBookingCard";
import { formatCurrency } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type BookingStatus } from "@/types";

interface Stats {
  totalBookings: number;
  upcomingCount: number;
  completedCount: number;
  totalSpent: number;
  loyaltyPoints: number;
  memberTier: string;
  nextBooking: null | {
    id: string; confirmationCode: string; pickupAddress: string;
    dropoffAddress: string | null; pickupDatetime: string;
    vehicleClass: string; passengers: number; luggage: number;
    totalAmount: number; paymentStatus: string; status: BookingStatus;
    flightNumber?: string | null;
    driver?: null | { user: { name: string | null; image: string | null }; rating: number; vehicles: { make: string; model: string; licensePlate: string }[] };
  };
  recentBookings: Array<{
    id: string; confirmationCode: string; status: BookingStatus;
    pickupAddress: string; dropoffAddress: string | null;
    pickupDatetime: string; totalAmount: number; paymentStatus: string;
    vehicleClass: string;
  }>;
}

const TIER_BENEFITS: Record<string, { label: string; perks: string[] }> = {
  Silver: { label: "Silver", perks: ["Priority support", "1% cashback points"] },
  Gold:   { label: "Gold",   perks: ["Priority booking", "2% cashback points", "Free meet & greet upgrade"] },
  VIP:    { label: "VIP",    perks: ["Dedicated concierge", "5% cashback points", "Complimentary upgrades", "VIP lounge access"] },
};

export default function DashboardOverview() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const user = session?.user as { name?: string; email?: string } | undefined;
  const firstName = user?.name?.split(" ")[0] ?? "there";

  useEffect(() => {
    fetch("/api/user/stats").then(r => r.json()).then(d => { setStats(d); setLoading(false); });
  }, []);

  const tier = stats?.memberTier ?? "Gold";
  const tierInfo = TIER_BENEFITS[tier] ?? TIER_BENEFITS.Gold;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-dark-800 to-dark-900 border border-gold-500/20 p-6"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_100%,rgba(201,168,76,0.08),transparent)]" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-gold-500" />
              <span className="text-gold-400 text-xs tracking-widest uppercase font-medium">Welcome back</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-white mb-1">{firstName} 👋</h2>
            <p className="text-dark-400 text-sm">Manage your bookings, track your rides, and enjoy elite service.</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <Star size={12} className="text-gold-500 fill-gold-500" />
                <span className="text-gold-400 text-xs font-medium uppercase tracking-wider">{tier} Member</span>
              </div>
              <p className="text-white font-display text-xl mt-0.5">{stats?.loyaltyPoints.toLocaleString() ?? "—"}</p>
              <p className="text-dark-500 text-xs">loyalty points</p>
            </div>
            <Link href="/dashboard/loyalty" className="btn-outline-gold px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1">
              View Benefits <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
              <div className="h-3 bg-dark-700 rounded w-16 mb-4" />
              <div className="h-8 bg-dark-700 rounded w-12" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Total Rides" value={stats?.totalBookings ?? 0} icon={<Calendar size={16} />} color="gold" delay={0} />
            <StatCard label="Upcoming" value={stats?.upcomingCount ?? 0} icon={<Clock size={16} />} color="blue" delay={100} />
            <StatCard label="Completed" value={stats?.completedCount ?? 0} icon={<CheckCircle2 size={16} />} color="green" delay={200} />
            <StatCard label="Total Spent" value={stats?.totalSpent ?? 0} prefix="€" icon={<Wallet size={16} />} color="purple" delay={300} />
          </>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">

        {/* Left — Upcoming booking + Recent */}
        <div className="xl:col-span-2 space-y-4">
          {/* Upcoming */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Next Trip</h3>
              <Link href="/dashboard/bookings?tab=upcoming" className="text-gold-400 hover:text-gold-300 text-xs flex items-center gap-1 transition-colors">
                View all <ArrowUpRight size={12} />
              </Link>
            </div>
            {loading ? (
              <div className="glass-card rounded-2xl p-6 animate-pulse space-y-3">
                <div className="h-4 bg-dark-700 rounded w-1/3" />
                <div className="h-3 bg-dark-700 rounded w-2/3" />
                <div className="h-3 bg-dark-700 rounded w-1/2" />
              </div>
            ) : stats?.nextBooking ? (
              <UpcomingBookingCard booking={stats.nextBooking as Parameters<typeof UpcomingBookingCard>[0]["booking"]} />
            ) : (
              <div className="glass-card rounded-2xl p-8 text-center border border-white/[0.06]">
                <Plane size={36} className="text-dark-600 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">No Upcoming Trips</p>
                <p className="text-dark-400 text-sm mb-5">Ready for your next luxury journey?</p>
                <Link href="/book" className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold">
                  Book a Transfer <ChevronRight size={14} />
                </Link>
              </div>
            )}
          </div>

          {/* Recent bookings */}
          {!loading && (stats?.recentBookings?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Recent Bookings</h3>
                <Link href="/dashboard/bookings" className="text-gold-400 hover:text-gold-300 text-xs flex items-center gap-1 transition-colors">
                  All bookings <ArrowUpRight size={12} />
                </Link>
              </div>
              <div className="glass-card rounded-2xl overflow-hidden border border-white/[0.06]">
                {stats!.recentBookings.slice(0, 5).map((b, i) => (
                  <Link
                    key={b.id}
                    href={`/booking/${b.id}/invoice`}
                    className={`flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors group ${i !== 0 ? "border-t border-white/[0.04]" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center flex-shrink-0">
                      <Car size={14} className="text-gold-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white text-xs font-medium truncate">{b.pickupAddress}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span>
                        <span className="text-dark-500 text-[10px]">
                          {new Date(b.pickupDatetime).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-gold-400 text-sm font-semibold">€{b.totalAmount.toFixed(0)}</p>
                      <ChevronRight size={12} className="text-dark-600 group-hover:text-dark-400 ml-auto transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — Membership + Quick actions */}
        <div className="space-y-4">

          {/* Membership card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative rounded-2xl overflow-hidden border border-gold-500/30 bg-gradient-to-br from-[#1a1500] to-dark-900 p-5"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_80%_20%,rgba(201,168,76,0.12),transparent)]" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-dark-400 text-[10px] uppercase tracking-widest mb-1">Elite Club</p>
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-gold-500 fill-gold-500" />
                    <span className="text-gold-400 font-semibold tracking-wide">{tier} Member</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-display text-2xl">{stats?.loyaltyPoints.toLocaleString() ?? "—"}</p>
                  <p className="text-dark-500 text-xs">points</p>
                </div>
              </div>
              <div className="space-y-1.5 mb-4">
                {tierInfo.perks.map(perk => (
                  <div key={perk} className="flex items-center gap-2 text-xs text-dark-300">
                    <CheckCircle2 size={11} className="text-gold-500 flex-shrink-0" />
                    {perk}
                  </div>
                ))}
              </div>
              <Link href="/dashboard/loyalty" className="btn-outline-gold w-full text-center py-2 rounded-xl text-xs font-medium block transition-all">
                View all benefits
              </Link>
            </div>
          </motion.div>

          {/* Quick actions */}
          <div className="glass-card rounded-2xl p-4 border border-white/[0.06]">
            <p className="text-dark-400 text-[10px] uppercase tracking-widest mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "New Booking",    href: "/book",                      icon: Plane,       color: "text-gold-500" },
                { label: "All Bookings",   href: "/dashboard/bookings",        icon: Calendar,    color: "text-blue-400" },
                { label: "Invoices",       href: "/dashboard/payments",        icon: Wallet,      color: "text-purple-400" },
                { label: "Saved Spots",    href: "/dashboard/locations",       icon: MapPin,      color: "text-emerald-400" },
                { label: "Loyalty",        href: "/dashboard/loyalty",         icon: Gift,        color: "text-amber-400" },
                { label: "Support",        href: "/dashboard/support",         icon: Sparkles,    color: "text-pink-400" },
              ].map(({ label, href, icon: Icon, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-dark-800/50 border border-white/[0.05] hover:border-gold-500/20 hover:bg-dark-700/50 transition-all group"
                >
                  <Icon size={18} className={`${color} group-hover:scale-110 transition-transform`} />
                  <span className="text-dark-300 text-[10px] text-center leading-tight group-hover:text-white transition-colors">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Refer & Earn */}
          <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-gradient-to-br from-dark-800 to-dark-900 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
                <Gift size={18} className="text-gold-500" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm mb-0.5">Refer & Earn €10</p>
                <p className="text-dark-400 text-xs leading-relaxed">Invite a friend and earn €10 credit when they complete their first booking.</p>
                <Link href="/dashboard/refer" className="text-gold-400 hover:text-gold-300 text-xs font-medium mt-2 inline-flex items-center gap-1 transition-colors">
                  Get referral link <ChevronRight size={11} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
