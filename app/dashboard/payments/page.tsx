"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CreditCard, Download, CheckCircle2, Clock, AlertCircle,
  RefreshCw, ArrowUpRight, Wallet, ChevronRight
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PaymentRecord {
  id: string;
  confirmationCode: string;
  totalAmount: number;
  paymentStatus: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string | null;
  pickupDatetime: string;
  vehicleClass: string;
  createdAt: string;
}

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  PAID:                <CheckCircle2 size={14} className="text-emerald-400" />,
  PENDING:             <Clock size={14} className="text-yellow-400" />,
  FAILED:              <AlertCircle size={14} className="text-red-400" />,
  REFUNDED:            <RefreshCw size={14} className="text-blue-400" />,
  PARTIALLY_REFUNDED:  <RefreshCw size={14} className="text-blue-300" />,
};

const PAYMENT_COLORS: Record<string, string> = {
  PAID:               "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  PENDING:            "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  FAILED:             "text-red-400 bg-red-500/10 border-red-500/20",
  REFUNDED:           "text-blue-400 bg-blue-500/10 border-blue-500/20",
  PARTIALLY_REFUNDED: "text-blue-300 bg-blue-400/10 border-blue-400/20",
};

export default function PaymentsPage() {
  const [bookings, setBookings] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/bookings")
      .then(r => r.json())
      .then(d => { setBookings(Array.isArray(d) ? d : (d.bookings ?? [])); setLoading(false); });
  }, []);

  const filtered = filter === "all" ? bookings : bookings.filter(b => b.paymentStatus === filter.toUpperCase());
  const totalPaid = bookings.filter(b => b.paymentStatus === "PAID").reduce((s, b) => s + b.totalAmount, 0);
  const totalPending = bookings.filter(b => b.paymentStatus === "PENDING").reduce((s, b) => s + b.totalAmount, 0);
  const totalRefunded = bookings.filter(b => ["REFUNDED", "PARTIALLY_REFUNDED"].includes(b.paymentStatus)).reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Paid", value: totalPaid, icon: <Wallet size={16} />, color: "emerald" },
          { label: "Pending", value: totalPending, icon: <Clock size={16} />, color: "yellow" },
          { label: "Refunded", value: totalRefunded, icon: <RefreshCw size={16} />, color: "blue" },
        ].map(({ label, value, icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-5 border border-white/[0.06]"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-dark-400 text-xs uppercase tracking-widest">{label}</p>
              <div className={`w-8 h-8 rounded-xl bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center text-${color}-400`}>
                {icon}
              </div>
            </div>
            <p className="font-display text-2xl text-white">€{value.toFixed(0)}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {["all", "paid", "pending", "refunded", "failed"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium capitalize transition-all ${filter === f ? "bg-gold-500/10 text-gold-400 border border-gold-500/20" : "text-dark-400 hover:text-white hover:bg-white/[0.04] border border-transparent"}`}
          >
            {f === "all" ? "All Payments" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Payment list */}
      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => <div key={i} className="glass-card rounded-2xl p-4 animate-pulse h-20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-white/[0.06]">
          <CreditCard size={36} className="text-dark-600 mx-auto mb-3" />
          <p className="text-white font-semibold">No payments found</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden border border-white/[0.06]">
          {filtered.map((b, i) => (
            <div key={b.id} className={`flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-white/[0.02] transition-colors ${i !== 0 ? "border-t border-white/[0.04]" : ""}`}>
              {/* Date */}
              <div className="text-center flex-shrink-0 w-10">
                <p className="text-white text-sm font-semibold leading-none">
                  {new Date(b.pickupDatetime).getDate()}
                </p>
                <p className="text-dark-500 text-[10px] uppercase">
                  {new Date(b.pickupDatetime).toLocaleDateString("en-GB", { month: "short" })}
                </p>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-white text-sm font-medium truncate">{b.pickupAddress}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-dark-500 text-xs font-mono">#{b.confirmationCode}</span>
                  <span className="text-dark-600 text-xs">·</span>
                  <span className="text-dark-500 text-xs">{b.vehicleClass.replace(/_/g, " ")}</span>
                </div>
              </div>

              {/* Status + Amount + Invoice */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium ${PAYMENT_COLORS[b.paymentStatus] ?? "text-dark-400 bg-dark-800 border-dark-600"}`}>
                  {PAYMENT_ICONS[b.paymentStatus]}
                  {b.paymentStatus}
                </span>
                <span className="font-display text-lg text-gold-400">{formatCurrency(b.totalAmount)}</span>
                <Link
                  href={`/booking/${b.id}/invoice`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-dark-800 border border-white/[0.08] text-dark-400 hover:text-white hover:border-white/[0.15] transition-all text-xs"
                >
                  <Download size={11} /> PDF
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SumUp payment note */}
      <div className="glass-card rounded-xl p-4 border border-white/[0.06] flex items-start gap-3">
        <CreditCard size={18} className="text-gold-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white text-sm font-medium">Secure Payments by SumUp</p>
          <p className="text-dark-400 text-xs mt-0.5">All payments are processed securely via SumUp. We accept all major credit cards, Apple Pay and Google Pay.</p>
        </div>
      </div>
    </div>
  );
}
