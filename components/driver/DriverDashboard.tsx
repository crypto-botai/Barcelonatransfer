"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Car, MapPin, Calendar, Star, Wallet, Plus, Loader2,
  CheckCircle2, Clock, XCircle, AlertCircle, TrendingUp,
  CreditCard, Smartphone, Phone, MessageCircle, Navigation,
  Power, Plane, PlayCircle, FlagTriangleRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type BookingStatus } from "@/types";
import toast from "react-hot-toast";

type Booking = {
  id: string;
  confirmationCode: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupDatetime: Date | string;
  passengers: number;
  luggage?: number;
  vehicleClass: string;
  totalAmount: number;
  driverAmount: number | null;
  guestName?: string | null;
  guestPhone?: string | null;
  flightNumber?: string | null;
};

type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  bankIban: string | null;
  bankName: string | null;
  bizumPhone: string | null;
  status: string;
  createdAt: Date | string;
};

type DriverInfo = {
  id: string;
  status: string;
  rating: number;
  totalRides: number;
  whatsappNumber: string | null;
  user: { name: string | null; email: string; phone: string | null };
};

type Props = {
  driver: DriverInfo;
  bookings: Booking[];
  withdrawals: Withdrawal[];
  completedCount: number;
  totalEarnings?: number;
};

type Tab = "upcoming" | "all" | "completed" | "cancelled" | "withdrawals";

const RIDE_STATUS_ICON: Record<string, React.ElementType> = {
  COMPLETED:       CheckCircle2,
  PENDING:         Clock,
  CONFIRMED:       Clock,
  DRIVER_ASSIGNED: Car,
  IN_PROGRESS:     Car,
  CANCELLED:       XCircle,
  REFUNDED:        AlertCircle,
};

const WITHDRAWAL_STATUS_STYLE: Record<string, string> = {
  PENDING:     "bg-yellow-500/20 text-yellow-400",
  COMPLETED:   "bg-blue-500/20 text-blue-400",
  TRANSFERRED: "bg-green-500/20 text-green-400",
};

export default function DriverDashboard({ driver, bookings, withdrawals: initialWithdrawals, completedCount, totalEarnings = 0 }: Props) {
  const [tab,            setTab]            = useState<Tab>("upcoming");
  const [withdrawals,    setWithdrawals]    = useState(initialWithdrawals);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [driverStatus,   setDriverStatus]   = useState(driver.status);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [rideAction,     setRideAction]     = useState<string | null>(null); // bookingId being acted on

  const handleRideAction = async (bookingId: string, action: "START" | "COMPLETE") => {
    setRideAction(bookingId);
    try {
      const res = await fetch("/api/driver/ride", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action }),
      });
      if (res.ok) {
        const { status } = await res.json();
        toast.success(action === "START" ? "Ride started!" : "Ride completed!");
        if (action === "START")    setDriverStatus("ON_RIDE");
        if (action === "COMPLETE") setDriverStatus("ONLINE");
        // Update local booking status
        window.location.reload(); // simplest refresh to reflect new status
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to update ride");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setRideAction(null);
    }
  };

  const toggleStatus = async () => {
    const next = driverStatus === "ONLINE" ? "OFFLINE" : "ONLINE";
    setTogglingStatus(true);
    try {
      const res = await fetch("/api/driver/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setDriverStatus(next);
        toast.success(`You are now ${next}`);
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setTogglingStatus(false);
    }
  };
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "", method: "BANK" as "BANK" | "BIZUM", bankIban: "", bankName: "", bizumPhone: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "upcoming",  label: "Upcoming",  count: bookings.filter(b => ["PENDING","CONFIRMED","DRIVER_ASSIGNED"].includes(b.status)).length },
    { id: "all",       label: "All Rides", count: bookings.length },
    { id: "completed", label: "Completed", count: completedCount },
    { id: "cancelled", label: "Cancelled", count: bookings.filter(b => b.status === "CANCELLED").length },
    { id: "withdrawals",label: "Withdrawals", count: withdrawals.length },
  ];

  const filteredBookings = bookings.filter((b) => {
    if (tab === "upcoming")  return ["PENDING","CONFIRMED","DRIVER_ASSIGNED","IN_PROGRESS"].includes(b.status);
    if (tab === "completed") return b.status === "COMPLETED";
    if (tab === "cancelled") return b.status === "CANCELLED" || b.status === "REFUNDED";
    return true;
  });

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawForm.amount || Number(withdrawForm.amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (withdrawForm.method === "BANK" && !withdrawForm.bankIban) {
      toast.error("Enter your IBAN");
      return;
    }
    if (withdrawForm.method === "BIZUM" && !withdrawForm.bizumPhone) {
      toast.error("Enter your Bizum phone number");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/driver/withdrawals", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          amount:    Number(withdrawForm.amount),
          method:    withdrawForm.method,
          bankIban:  withdrawForm.bankIban || undefined,
          bankName:  withdrawForm.bankName || undefined,
          bizumPhone:withdrawForm.bizumPhone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      setWithdrawals((w) => [data, ...w]);
      setShowWithdrawForm(false);
      setWithdrawForm({ amount: "", method: "BANK", bankIban: "", bankName: "", bizumPhone: "" });
      toast.success("Withdrawal request submitted");
      setTab("withdrawals");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] pt-20">
      <div className="container mx-auto px-4 py-10 max-w-4xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8 flex-wrap gap-4"
        >
          <div>
            <h1 className="font-display text-3xl text-white">
              Welcome, {driver.user.name ?? "Driver"}
            </h1>
            <p className="text-dark-400 mt-1 text-sm flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${driverStatus === "ONLINE" || driverStatus === "ON_RIDE" ? "bg-green-400" : "bg-gray-500"}`} />
              <span className={
                driverStatus === "ONLINE"  ? "text-green-400" :
                driverStatus === "ON_RIDE" ? "text-blue-400"  : "text-yellow-400"
              }>
                {driverStatus.replace(/_/g, " ")}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Online/Offline toggle */}
            {driverStatus !== "ON_RIDE" && (
              <button
                onClick={toggleStatus}
                disabled={togglingStatus}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  driverStatus === "ONLINE"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30"
                    : "bg-white/[0.04] text-dark-400 border border-white/[0.08] hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/30"
                }`}
              >
                {togglingStatus ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
                {driverStatus === "ONLINE" ? "Go Offline" : "Go Online"}
              </button>
            )}
            <button
              onClick={() => { setShowWithdrawForm(true); setTab("withdrawals"); }}
              className="btn-gold flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              <Wallet size={15} /> Withdraw
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Wallet,     label: "Total Earned",  value: formatCurrency(totalEarnings),                    color: "text-gold-400" },
            { icon: CheckCircle2,label:"Completed",     value: completedCount,                                   color: "text-green-400" },
            { icon: Star,       label: "Rating",        value: driver.rating > 0 ? `${driver.rating.toFixed(1)}★` : "—", color: "text-yellow-400" },
            { icon: TrendingUp, label: "Upcoming",      value: bookings.filter(b => ["PENDING","CONFIRMED","DRIVER_ASSIGNED"].includes(b.status)).length, color: "text-blue-400" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="glass-card rounded-xl p-4 text-center">
              <Icon size={18} className={`${color} mx-auto mb-2`} />
              <p className={`font-display text-2xl ${color}`}>{value}</p>
              <p className="text-dark-400 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
                tab === t.id
                  ? "bg-gold-500 text-black"
                  : "border border-white/[0.08] text-dark-400 hover:text-white"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  tab === t.id ? "bg-black/20 text-black" : "bg-white/10 text-dark-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Rides list */}
        {tab !== "withdrawals" && (
          <div className="glass-card rounded-2xl overflow-hidden">
            {filteredBookings.length === 0 ? (
              <div className="py-16 text-center">
                <Car size={32} className="text-dark-600 mx-auto mb-3" />
                <p className="text-dark-400">No rides in this category.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {filteredBookings.map((b) => {
                  const StatusIcon = RIDE_STATUS_ICON[b.status] ?? Car;
                  return (
                    <div key={b.id} className="p-5 hover:bg-white/[0.01] transition-colors">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`status-badge flex items-center gap-1 ${STATUS_COLORS[b.status as BookingStatus] ?? "bg-gray-500/20 text-gray-400"}`}>
                              <StatusIcon size={10} />
                              {STATUS_LABELS[b.status as BookingStatus] ?? b.status.replace(/_/g, " ")}
                            </span>
                            <span className="text-dark-600 text-xs font-mono">{b.confirmationCode}</span>
                          </div>
                          <div className="flex items-start gap-2 text-sm text-dark-200 mb-1">
                            <MapPin size={13} className="text-gold-500 mt-0.5 flex-shrink-0" />
                            <span className="truncate">{b.pickupAddress}</span>
                          </div>
                          <div className="flex items-start gap-2 text-sm text-dark-400">
                            <MapPin size={13} className="text-dark-600 mt-0.5 flex-shrink-0" />
                            <span className="truncate">{b.dropoffAddress}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-dark-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar size={11} /> {formatDate(new Date(b.pickupDatetime))}
                            </span>
                            <span>{b.passengers} pax</span>
                            {b.luggage != null && b.luggage > 0 && <span>{b.luggage} bags</span>}
                            {b.flightNumber && <span className="flex items-center gap-1 text-blue-400"><Plane size={10} />{b.flightNumber}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {b.driverAmount != null
                            ? <p className="font-display text-xl text-gold-400">{formatCurrency(b.driverAmount)}</p>
                            : <p className="font-display text-xl text-dark-600">TBC</p>
                          }
                        </div>
                      </div>

                      {/* Ride action buttons */}
                      {b.status === "DRIVER_ASSIGNED" && (
                        <div className="mt-3 pt-3 border-t border-white/[0.04]">
                          <button
                            onClick={() => handleRideAction(b.id, "START")}
                            disabled={rideAction === b.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 text-sm font-medium hover:bg-blue-500/25 transition-colors"
                          >
                            {rideAction === b.id ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                            Start Ride
                          </button>
                        </div>
                      )}
                      {b.status === "IN_PROGRESS" && (
                        <div className="mt-3 pt-3 border-t border-white/[0.04]">
                          <button
                            onClick={() => handleRideAction(b.id, "COMPLETE")}
                            disabled={rideAction === b.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/15 text-green-400 border border-green-500/30 text-sm font-medium hover:bg-green-500/25 transition-colors"
                          >
                            {rideAction === b.id ? <Loader2 size={14} className="animate-spin" /> : <FlagTriangleRight size={14} />}
                            Complete Ride
                          </button>
                        </div>
                      )}

                      {/* Customer contact + navigation (only for active/upcoming rides) */}
                      {["DRIVER_ASSIGNED","IN_PROGRESS","CONFIRMED","PENDING"].includes(b.status) && (
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/[0.04]">
                          {b.guestName && (
                            <span className="text-xs text-dark-400 flex items-center gap-1">
                              <Car size={10} className="text-gold-500" /> {b.guestName}
                            </span>
                          )}
                          {b.guestPhone && (
                            <>
                              <a href={`tel:${b.guestPhone}`}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/15 transition-colors">
                                <Phone size={10} /> Call
                              </a>
                              <a href={`https://wa.me/${b.guestPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs hover:bg-green-500/15 transition-colors">
                                <MessageCircle size={10} /> WhatsApp
                              </a>
                            </>
                          )}
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.pickupAddress)}`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gold-500/10 border border-gold-500/20 text-gold-400 text-xs hover:bg-gold-500/15 transition-colors">
                            <Navigation size={10} /> Navigate
                          </a>
                          <a
                            href={`https://waze.com/ul?q=${encodeURIComponent(b.pickupAddress)}&navigate=yes`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/15 transition-colors">
                            <Navigation size={10} /> Waze
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Withdrawals tab */}
        {tab === "withdrawals" && (
          <div className="space-y-4">
            {/* Withdrawal form */}
            {showWithdrawForm && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl p-6"
              >
                <h3 className="text-white font-medium mb-5 flex items-center gap-2">
                  <Plus size={16} className="text-gold-500" /> New Withdrawal Request
                </h3>
                <form onSubmit={handleWithdraw} className="space-y-4">
                  {/* Amount */}
                  <div>
                    <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Amount (€)</label>
                    <input
                      type="number" min="1" step="0.01" required
                      placeholder="e.g. 150.00"
                      value={withdrawForm.amount}
                      onChange={(e) => setWithdrawForm((f) => ({ ...f, amount: e.target.value }))}
                      className="input-luxury w-full px-4 py-3 rounded-xl"
                    />
                  </div>

                  {/* Method */}
                  <div>
                    <label className="text-xs text-dark-400 uppercase tracking-wider block mb-2">Payment Method</label>
                    <div className="flex gap-3">
                      {[
                        { id: "BANK",  icon: CreditCard,  label: "Bank Transfer" },
                        { id: "BIZUM", icon: Smartphone,  label: "Bizum" },
                      ].map(({ id, icon: Icon, label }) => (
                        <button
                          key={id} type="button"
                          onClick={() => setWithdrawForm((f) => ({ ...f, method: id as "BANK" | "BIZUM" }))}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                            withdrawForm.method === id
                              ? "border-gold-500 bg-gold-500/10 text-gold-400"
                              : "border-white/[0.08] text-dark-400 hover:border-white/20"
                          }`}
                        >
                          <Icon size={15} /> {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bank fields */}
                  {withdrawForm.method === "BANK" && (
                    <>
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">IBAN *</label>
                        <input
                          type="text" required placeholder="ES76 2100 0813 6101 2345 6789"
                          value={withdrawForm.bankIban}
                          onChange={(e) => setWithdrawForm((f) => ({ ...f, bankIban: e.target.value }))}
                          className="input-luxury w-full px-4 py-3 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Bank Name (optional)</label>
                        <input
                          type="text" placeholder="e.g. CaixaBank"
                          value={withdrawForm.bankName}
                          onChange={(e) => setWithdrawForm((f) => ({ ...f, bankName: e.target.value }))}
                          className="input-luxury w-full px-4 py-3 rounded-xl"
                        />
                      </div>
                    </>
                  )}

                  {/* Bizum fields */}
                  {withdrawForm.method === "BIZUM" && (
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Bizum Phone Number *</label>
                      <input
                        type="tel" required placeholder="+34 600 000 000"
                        value={withdrawForm.bizumPhone}
                        onChange={(e) => setWithdrawForm((f) => ({ ...f, bizumPhone: e.target.value }))}
                        className="input-luxury w-full px-4 py-3 rounded-xl"
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowWithdrawForm(false)}
                      className="flex-1 py-3 rounded-xl border border-white/10 text-dark-400 hover:text-white text-sm transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit" disabled={submitting}
                      className="flex-1 btn-gold py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      {submitting && <Loader2 size={14} className="animate-spin" />}
                      Submit Request
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Withdrawal history */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Wallet size={15} className="text-gold-500" /> Withdrawal History
                </h3>
                {!showWithdrawForm && (
                  <button
                    onClick={() => setShowWithdrawForm(true)}
                    className="flex items-center gap-1.5 text-gold-500 text-xs hover:text-gold-400"
                  >
                    <Plus size={12} /> New Request
                  </button>
                )}
              </div>

              {withdrawals.length === 0 ? (
                <div className="py-12 text-center">
                  <Wallet size={28} className="text-dark-600 mx-auto mb-3" />
                  <p className="text-dark-400 text-sm">No withdrawal requests yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="p-5 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gold-500/10 flex items-center justify-center">
                          {w.method === "BIZUM"
                            ? <Smartphone size={16} className="text-gold-500" />
                            : <CreditCard  size={16} className="text-gold-500" />
                          }
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{w.method === "BIZUM" ? "Bizum" : "Bank Transfer"}</p>
                          <p className="text-dark-500 text-xs">
                            {w.method === "BIZUM"
                              ? w.bizumPhone
                              : w.bankIban ?? w.bankName ?? "—"}
                          </p>
                          <p className="text-dark-600 text-xs">
                            {new Date(w.createdAt).toLocaleDateString("en-GB")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`status-badge ${WITHDRAWAL_STATUS_STYLE[w.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                          {w.status}
                        </span>
                        <p className="font-display text-lg text-gold-400">{formatCurrency(w.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
