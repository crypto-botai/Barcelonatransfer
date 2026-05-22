"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MapPin, Clock, Calendar, Users, Briefcase, Phone,
  MessageCircle, Navigation, Edit3, X, ChevronRight,
  Star, Car, AlertCircle, CheckCircle2, Loader2
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type BookingStatus } from "@/types";

interface Driver {
  user: { name?: string | null; image?: string | null };
  rating: number;
  vehicles: { make: string; model: string; licensePlate: string }[];
}

interface Booking {
  id: string;
  confirmationCode: string;
  pickupAddress: string;
  dropoffAddress: string | null;
  pickupDatetime: string | Date;
  vehicleClass: string;
  passengers: number;
  luggage: number;
  totalAmount: number;
  paymentStatus: string;
  status: BookingStatus;
  flightNumber?: string | null;
  driver?: Driver | null;
}

function useCountdown(targetDate: Date) {
  const [diff, setDiff] = useState(targetDate.getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setDiff(targetDate.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 48) return `${Math.floor(h / 24)} days`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export default function UpcomingBookingCard({ booking }: { booking: Booking }) {
  const pickupTime = new Date(booking.pickupDatetime);
  const countdown = useCountdown(pickupTime);
  const driver = booking.driver;
  const vehicle = driver?.vehicles?.[0];
  const isImminent = countdown && (countdown.includes("m") && !countdown.includes("h") && !countdown.includes("d"));
  const [cancelling, setCancelling] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-2xl overflow-hidden border border-white/[0.08] hover:border-gold-500/30 transition-all duration-300"
    >
      {/* Status bar */}
      <div className={`h-0.5 ${booking.status === "IN_PROGRESS" ? "bg-gradient-to-r from-green-500 to-emerald-400" : booking.status === "DRIVER_ASSIGNED" ? "bg-gradient-to-r from-purple-500 to-violet-400" : "bg-gradient-to-r from-gold-500 to-gold-300"}`} />

      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`status-badge text-xs px-2.5 py-1 rounded-lg border font-medium ${STATUS_COLORS[booking.status]}`}>
              {STATUS_LABELS[booking.status]}
            </span>
            <span className="text-dark-500 text-xs font-mono bg-dark-800 px-2 py-1 rounded-lg">
              #{booking.confirmationCode}
            </span>
            {booking.flightNumber && (
              <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                ✈ {booking.flightNumber}
              </span>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-display text-xl text-gold-400">{formatCurrency(booking.totalAmount)}</p>
            <p className={`text-xs mt-0.5 ${booking.paymentStatus === "PAID" ? "text-emerald-400" : "text-yellow-400"}`}>
              {booking.paymentStatus === "PAID" ? "✓ Paid" : booking.paymentStatus}
            </p>
          </div>
        </div>

        {/* Route */}
        <div className="flex gap-3 mb-4">
          <div className="flex flex-col items-center pt-1 gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-gold-500 shadow-[0_0_8px_rgba(201,168,76,0.6)]" />
            <div className="w-px flex-1 bg-gradient-to-b from-gold-500/60 to-dark-700 min-h-[24px]" />
            <div className="w-2.5 h-2.5 rounded-full border-2 border-dark-400" />
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <div>
              <p className="text-[10px] text-dark-500 uppercase tracking-widest mb-0.5">Pickup</p>
              <p className="text-white text-sm font-medium leading-tight truncate">{booking.pickupAddress}</p>
            </div>
            <div>
              <p className="text-[10px] text-dark-500 uppercase tracking-widest mb-0.5">Drop-off</p>
              <p className="text-dark-300 text-sm leading-tight truncate">{booking.dropoffAddress ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Trip details */}
        <div className="flex flex-wrap gap-3 mb-5 text-xs text-dark-400">
          <span className="flex items-center gap-1.5 bg-dark-800 px-2.5 py-1.5 rounded-lg">
            <Calendar size={12} className="text-gold-500" />
            {pickupTime.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <span className="flex items-center gap-1.5 bg-dark-800 px-2.5 py-1.5 rounded-lg">
            <Clock size={12} className="text-gold-500" />
            {pickupTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="flex items-center gap-1.5 bg-dark-800 px-2.5 py-1.5 rounded-lg">
            <Car size={12} className="text-gold-500" />
            {booking.vehicleClass.replace(/_/g, " ")}
          </span>
          <span className="flex items-center gap-1.5 bg-dark-800 px-2.5 py-1.5 rounded-lg">
            <Users size={12} className="text-gold-500" />
            {booking.passengers} pax
          </span>
          <span className="flex items-center gap-1.5 bg-dark-800 px-2.5 py-1.5 rounded-lg">
            <Briefcase size={12} className="text-gold-500" />
            {booking.luggage} bags
          </span>
        </div>

        {/* Countdown & Driver */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {/* Countdown */}
          {countdown && (
            <div className={`rounded-xl p-3 border ${isImminent ? "bg-amber-500/5 border-amber-500/20" : "bg-dark-800/50 border-white/[0.06]"}`}>
              <p className="text-[10px] text-dark-500 uppercase tracking-widest mb-1">Pickup In</p>
              <p className={`font-display text-2xl font-semibold ${isImminent ? "text-amber-400" : "text-white"}`}>{countdown}</p>
              {isImminent && (
                <p className="text-amber-400 text-[10px] mt-0.5 flex items-center gap-1">
                  <AlertCircle size={10} /> Your driver is nearby
                </p>
              )}
            </div>
          )}

          {/* Driver */}
          {driver ? (
            <div className="rounded-xl p-3 bg-dark-800/50 border border-white/[0.06]">
              <p className="text-[10px] text-dark-500 uppercase tracking-widest mb-2">Your Driver</p>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-dark-700 border border-white/[0.1] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden">
                  {driver.user.image ? (
                    <img src={driver.user.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    driver.user.name?.[0]?.toUpperCase() ?? "D"
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{driver.user.name ?? "Driver"}</p>
                  <div className="flex items-center gap-1">
                    <Star size={10} className="text-gold-500 fill-gold-500" />
                    <span className="text-gold-400 text-xs">{driver.rating?.toFixed(1) ?? "4.9"}</span>
                    {vehicle && <span className="text-dark-500 text-xs">· {vehicle.make} {vehicle.model}</span>}
                  </div>
                </div>
              </div>
              {vehicle && (
                <div className="mt-2 text-xs text-dark-500 font-mono bg-dark-900 rounded-lg px-2 py-1 inline-block">
                  {vehicle.licensePlate}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl p-3 bg-dark-800/50 border border-white/[0.06] flex items-center gap-2">
              <Loader2 size={16} className="text-dark-500 animate-spin" />
              <div>
                <p className="text-dark-400 text-sm">Assigning driver…</p>
                <p className="text-dark-600 text-xs mt-0.5">We&apos;ll notify you when assigned</p>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/tracking/${booking.id}`}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 bg-gold-500/10 border border-gold-500/20 text-gold-400 hover:bg-gold-500/15 hover:border-gold-500/40 rounded-xl py-2.5 text-xs font-semibold transition-all"
          >
            <Navigation size={13} /> Live Tracking
          </Link>
          <Link
            href={`/booking/${booking.id}/invoice`}
            className="flex items-center gap-1.5 bg-dark-800 border border-white/[0.08] text-dark-300 hover:text-white hover:border-white/[0.15] rounded-xl px-3 py-2.5 text-xs font-medium transition-all"
          >
            <Edit3 size={12} /> Details
          </Link>
          <a
            href={`https://wa.me/34635383712?text=Hi, I need help with booking ${booking.confirmationCode}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/15 rounded-xl px-3 py-2.5 text-xs font-medium transition-all"
          >
            <MessageCircle size={12} /> WhatsApp
          </a>
          {["PENDING", "CONFIRMED"].includes(booking.status) && (
            <button
              onClick={() => setCancelling(true)}
              disabled={cancelling}
              className="flex items-center gap-1.5 bg-red-500/5 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl px-3 py-2.5 text-xs font-medium transition-all disabled:opacity-50"
            >
              <X size={12} /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Cancel modal */}
      {cancelling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-900 border border-white/[0.1] rounded-2xl p-6 max-w-sm w-full shadow-luxury"
          >
            <h3 className="font-display text-xl text-white mb-2">Cancel Booking?</h3>
            <p className="text-dark-400 text-sm mb-6">
              Are you sure you want to cancel booking <span className="text-white font-mono">{booking.confirmationCode}</span>? Free cancellation applies up to 24 hours before pickup.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelling(false)}
                className="flex-1 py-3 rounded-xl border border-white/[0.1] text-dark-300 hover:text-white hover:border-white/[0.2] transition-all text-sm font-medium"
              >
                Keep Booking
              </button>
              <button
                onClick={async () => {
                  await fetch(`/api/bookings/${booking.id}`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }), headers: { "Content-Type": "application/json" } });
                  setCancelling(false);
                  window.location.reload();
                }}
                className="flex-1 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/15 transition-all text-sm font-medium"
              >
                Cancel Booking
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
