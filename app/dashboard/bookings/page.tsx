"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Filter, Calendar, Clock, CheckCircle2, XCircle,
  AlertCircle, ChevronRight, Download, RefreshCw, Car,
  MapPin, Users, ArrowUpDown, CreditCard, Star
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type BookingStatus } from "@/types";

type Tab = "all" | "upcoming" | "completed" | "cancelled" | "pending";

interface Booking {
  id: string;
  confirmationCode: string;
  status: BookingStatus;
  paymentStatus: string;
  pickupAddress: string;
  dropoffAddress: string | null;
  pickupDatetime: string;
  vehicleClass: string;
  passengers: number;
  totalAmount: number;
  createdAt: string;
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "all",       label: "All",       icon: Calendar },
  { id: "upcoming",  label: "Upcoming",  icon: Clock },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
  { id: "cancelled", label: "Cancelled", icon: XCircle },
  { id: "pending",   label: "Pending",   icon: AlertCircle },
];

const STATUS_BY_TAB: Record<Tab, string[]> = {
  all:       [],
  upcoming:  ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"],
  completed: ["COMPLETED"],
  cancelled: ["CANCELLED", "REFUNDED"],
  pending:   ["PENDING"],
};

function BookingsContent() {
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get("tab") as Tab) ?? "all";
  const [activeTab, setActiveTab] = useState<Tab>(tabParam);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filtered, setFiltered] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  useEffect(() => {
    fetch("/api/bookings")
      .then(r => r.json())
      .then(d => { setBookings(Array.isArray(d) ? d : (d.bookings ?? [])); setLoading(false); });
  }, []);

  const applyFilters = useCallback(() => {
    let result = [...bookings];
    const statuses = STATUS_BY_TAB[activeTab];
    if (statuses.length) result = result.filter(b => statuses.includes(b.status));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        b.confirmationCode.toLowerCase().includes(q) ||
        b.pickupAddress.toLowerCase().includes(q) ||
        (b.dropoffAddress ?? "").toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const diff = new Date(a.pickupDatetime).getTime() - new Date(b.pickupDatetime).getTime();
      return sortDir === "asc" ? diff : -diff;
    });
    setFiltered(result);
    setPage(1);
  }, [bookings, activeTab, search, sortDir]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">

      {/* Search & sort bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            placeholder="Search by code, address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-luxury w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
          />
        </div>
        <button
          onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/[0.08] text-dark-400 hover:text-white hover:border-white/[0.15] transition-all text-sm"
        >
          <ArrowUpDown size={14} />
          <span className="hidden sm:inline">{sortDir === "desc" ? "Newest" : "Oldest"}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = id === "all" ? bookings.length : bookings.filter(b => STATUS_BY_TAB[id].includes(b.status)).length;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                activeTab === id
                  ? "bg-gold-500/10 text-gold-400 border border-gold-500/20"
                  : "text-dark-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Icon size={13} />
              {label}
              {count > 0 && (
                <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === id ? "bg-gold-500/20 text-gold-400" : "bg-dark-700 text-dark-400"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
              <div className="flex gap-3">
                <div className="h-10 w-10 bg-dark-700 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-dark-700 rounded w-1/4" />
                  <div className="h-3 bg-dark-700 rounded w-2/3" />
                </div>
                <div className="h-6 w-16 bg-dark-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-white/[0.06]">
          <Calendar size={40} className="text-dark-600 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">No bookings found</p>
          <p className="text-dark-400 text-sm mb-5">{search ? "Try a different search term." : "You have no bookings in this category."}</p>
          <Link href="/book" className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold">
            Book a Transfer
          </Link>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={activeTab + search} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {paginated.map((b, i) => {
              const pickup = new Date(b.pickupDatetime);
              const isPast = pickup < new Date();
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass-card rounded-2xl overflow-hidden border border-white/[0.06] hover:border-gold-500/20 transition-all group"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl bg-dark-800 border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <Car size={16} className="text-gold-500" />
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium ${STATUS_COLORS[b.status]}`}>
                            {STATUS_LABELS[b.status]}
                          </span>
                          <span className="text-dark-500 text-xs font-mono">#{b.confirmationCode}</span>
                          {b.paymentStatus === "PAID" && (
                            <span className="text-emerald-400 text-[10px] flex items-center gap-0.5">
                              <CheckCircle2 size={9} /> Paid
                            </span>
                          )}
                        </div>
                        <p className="text-white text-sm font-medium mb-0.5 truncate">{b.pickupAddress}</p>
                        {b.dropoffAddress && (
                          <p className="text-dark-400 text-xs truncate flex items-center gap-1">
                            <ChevronRight size={10} /> {b.dropoffAddress}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-dark-500">
                          <span className="flex items-center gap-1"><Calendar size={10} /> {pickup.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                          <span className="flex items-center gap-1"><Clock size={10} /> {pickup.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="flex items-center gap-1"><Users size={10} /> {b.passengers} pax</span>
                          <span className="flex items-center gap-1"><Car size={10} /> {b.vehicleClass.replace(/_/g, " ")}</span>
                        </div>
                      </div>

                      {/* Price + actions */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <p className="font-display text-lg text-gold-400">{formatCurrency(b.totalAmount)}</p>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/booking/${b.id}/invoice`}
                            className="flex items-center gap-1 text-[10px] text-dark-400 hover:text-gold-400 px-2 py-1 rounded-lg border border-white/[0.06] hover:border-gold-500/20 transition-all"
                          >
                            <Download size={10} /> Invoice
                          </Link>
                          {!isPast && !["CANCELLED", "REFUNDED"].includes(b.status) && (
                            <Link
                              href={`/dashboard/tracking/${b.id}`}
                              className="flex items-center gap-1 text-[10px] text-gold-400 px-2 py-1 rounded-lg bg-gold-500/10 border border-gold-500/20 hover:bg-gold-500/15 transition-all"
                            >
                              Track
                            </Link>
                          )}
                          {b.status === "COMPLETED" && (
                            <Link
                              href={`/review?bookingId=${b.id}`}
                              className="flex items-center gap-1 text-[10px] text-amber-400 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-all"
                            >
                              <Star size={10} /> Review
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 rounded-xl border border-white/[0.08] text-dark-400 hover:text-white hover:border-white/[0.15] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${p === page ? "bg-gold-500/10 text-gold-400 border border-gold-500/20" : "text-dark-400 hover:text-white border border-transparent hover:border-white/[0.08]"}`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 rounded-xl border border-white/[0.08] text-dark-400 hover:text-white hover:border-white/[0.15] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <BookingsContent />
    </Suspense>
  );
}
