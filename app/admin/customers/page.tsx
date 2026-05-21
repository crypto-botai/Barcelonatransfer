"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Star, AlertOctagon, RefreshCw,
  X, ChevronRight, TrendingUp, Repeat2, Phone, Mail,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Customer = {
  id:            string;
  name:          string | null;
  email:         string;
  phone:         string | null;
  createdAt:     string;
  totalBookings: number;
  totalRides:    number;
  totalSpent:    number;
  lastBooking:   string | null;
  isVip:         boolean;
  isBlacklisted: boolean;
  notes:         string | null;
  vipSince:      string | null;
};

type Stats = { total: number; vip: number; blacklisted: number; repeat: number };

export default function CustomersPage() {
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [stats,     setStats]       = useState<Stats>({ total: 0, vip: 0, blacklisted: 0, repeat: 0 });
  const [loading,   setLoading]     = useState(true);
  const [search,    setSearch]      = useState("");
  const [filter,    setFilter]      = useState<"all" | "vip" | "blacklisted" | "repeat">("all");
  const [selected,  setSelected]    = useState<Customer | null>(null);
  const [saving,    setSaving]      = useState(false);
  const [notes,     setNotes]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/customers?q=${encodeURIComponent(search)}&filter=${filter}`);
      const data = await res.json();
      setCustomers(data.customers ?? []);
      setStats(data.stats ?? { total: 0, vip: 0, blacklisted: 0, repeat: 0 });
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => { load(); }, [load]);

  const openCustomer = (c: Customer) => {
    setSelected(c);
    setNotes(c.notes ?? "");
  };

  const updateCustomer = async (id: string, patch: { isVip?: boolean; isBlacklisted?: boolean; notes?: string }) => {
    setSaving(true);
    try {
      await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setCustomers((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
      if (selected?.id === id) setSelected((s) => s ? { ...s, ...patch } : s);
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    await updateCustomer(selected.id, { notes });
  };

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-white">Customer CRM</h1>
          <p className="text-dark-400 text-sm mt-1">Manage customer profiles, VIP status, and relationships</p>
        </div>
        <button onClick={load} className="btn-outline-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Users,        label: "Total Customers", value: stats.total,       color: "text-white" },
          { icon: Star,         label: "VIP Customers",   value: stats.vip,         color: "text-gold-400" },
          { icon: Repeat2,      label: "Repeat Clients",  value: stats.repeat,      color: "text-green-400" },
          { icon: AlertOctagon, label: "Blacklisted",     value: stats.blacklisted, color: "text-red-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass-card rounded-xl p-5">
            <Icon size={18} className={`${color} mb-3`} />
            <p className="text-dark-400 text-xs uppercase tracking-wider">{label}</p>
            <p className={`font-display text-2xl mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="input-luxury w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "vip", "repeat", "blacklisted"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-sm capitalize transition-all ${
                filter === f ? "bg-gold-500 text-black font-medium" : "bg-white/[0.04] text-dark-400 hover:text-white"
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Customer table */}
        <div className={`glass-card rounded-xl overflow-hidden flex-1 transition-all duration-300 ${selected ? "lg:max-w-[60%]" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Customer", "Contact", "Rides", "Spent", "Last Booking", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-dark-400 uppercase tracking-wider font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-dark-400">
                    <div className="w-6 h-6 border border-gold-500/30 border-t-gold-500 rounded-full animate-spin mx-auto" />
                  </td></tr>
                ) : customers.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-dark-400">No customers found</td></tr>
                ) : customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openCustomer(c)}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors ${selected?.id === c.id ? "bg-white/[0.04]" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 text-xs font-semibold flex-shrink-0">
                          {(c.name ?? c.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{c.name ?? "No name"}</p>
                          <p className="text-dark-500 text-xs">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-dark-400 text-xs">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-white">{c.totalRides}</td>
                    <td className="px-4 py-3 text-gold-400 font-medium">{formatCurrency(c.totalSpent)}</td>
                    <td className="px-4 py-3 text-dark-400 text-xs">
                      {c.lastBooking ? new Date(c.lastBooking).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {c.isVip && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-gold-500/20 text-gold-400 font-medium">VIP</span>
                        )}
                        {c.isBlacklisted && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-medium">Blocked</span>
                        )}
                        {c.totalBookings > 1 && !c.isVip && !c.isBlacklisted && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400">Repeat</span>
                        )}
                        {c.totalBookings === 1 && !c.isVip && !c.isBlacklisted && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-dark-400">New</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={14} className="text-dark-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer detail drawer */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-80 flex-shrink-0"
            >
              <div className="glass-card rounded-xl p-5 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-medium">Customer Profile</h3>
                  <button onClick={() => setSelected(null)} className="text-dark-400 hover:text-white transition-colors">
                    <X size={16} />
                  </button>
                </div>

                {/* Avatar & name */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 text-lg font-semibold">
                    {(selected.name ?? selected.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium">{selected.name ?? "No name"}</p>
                    <p className="text-dark-400 text-xs">Customer since {new Date(selected.createdAt).toLocaleDateString("en-GB")}</p>
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-2 mb-4 pb-4 border-b border-white/[0.06]">
                  <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-xs text-dark-400 hover:text-gold-400 transition-colors">
                    <Mail size={12} className="text-gold-500/50" /> {selected.email}
                  </a>
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`} className="flex items-center gap-2 text-xs text-dark-400 hover:text-gold-400 transition-colors">
                      <Phone size={12} className="text-gold-500/50" /> {selected.phone}
                    </a>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-white/[0.06]">
                  {[
                    { label: "Bookings", value: selected.totalBookings },
                    { label: "Rides",    value: selected.totalRides },
                    { label: "Spent",    value: formatCurrency(selected.totalSpent) },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <p className="text-white font-medium text-sm">{value}</p>
                      <p className="text-dark-500 text-[10px]">{label}</p>
                    </div>
                  ))}
                </div>

                {/* VIP / Blacklist toggles */}
                <div className="space-y-2 mb-4 pb-4 border-b border-white/[0.06]">
                  <button
                    onClick={() => updateCustomer(selected.id, { isVip: !selected.isVip })}
                    disabled={saving}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      selected.isVip ? "border-gold-500/50 bg-gold-500/10 text-gold-400" : "border-white/[0.06] text-dark-400 hover:text-gold-400 hover:border-gold-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Star size={14} />
                      VIP Customer
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${selected.isVip ? "bg-gold-500/20 text-gold-400" : "bg-white/10 text-dark-500"}`}>
                      {selected.isVip ? "Active" : "Off"}
                    </span>
                  </button>

                  <button
                    onClick={() => updateCustomer(selected.id, { isBlacklisted: !selected.isBlacklisted })}
                    disabled={saving}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      selected.isBlacklisted ? "border-red-500/50 bg-red-500/10 text-red-400" : "border-white/[0.06] text-dark-400 hover:text-red-400 hover:border-red-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertOctagon size={14} />
                      Blacklist
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${selected.isBlacklisted ? "bg-red-500/20 text-red-400" : "bg-white/10 text-dark-500"}`}>
                      {selected.isBlacklisted ? "Blocked" : "Off"}
                    </span>
                  </button>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs text-dark-400 uppercase tracking-wider block mb-2">Admin Notes</label>
                  <textarea
                    rows={3} value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes about this customer…"
                    className="input-luxury w-full px-3 py-2.5 rounded-lg text-xs resize-none"
                  />
                  <button
                    onClick={saveNotes}
                    disabled={saving}
                    className="btn-gold w-full py-2.5 rounded-lg text-sm font-medium mt-2"
                  >
                    {saving ? "Saving…" : "Save Notes"}
                  </button>
                </div>

                {/* LTV insight */}
                <div className="mt-4 bg-gold-500/5 border border-gold-500/15 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={12} className="text-gold-400" />
                    <span className="text-gold-400 text-xs font-medium">Lifetime Value</span>
                  </div>
                  <p className="text-white text-lg font-semibold">{formatCurrency(selected.totalSpent)}</p>
                  <p className="text-dark-500 text-[10px] mt-0.5">Avg {formatCurrency(selected.totalRides > 0 ? selected.totalSpent / selected.totalRides : 0)} per ride</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
