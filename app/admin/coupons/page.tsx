"use client";

import { useEffect, useState } from "react";
import { Tag, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";

type Coupon = {
  id:          string;
  code:        string;
  email:       string | null;
  discountPct: number;
  usedAt:      string | null;
  expiresAt:   string;
  isActive:    boolean;
  bookingId:   string | null;
  createdAt:   string;
};

type Stats = { total: number; used: number; expired: number; active: number };

export default function CouponsPage() {
  const [coupons,  setCoupons]  = useState<Coupon[]>([]);
  const [stats,    setStats]    = useState<Stats>({ total: 0, used: 0, expired: 0, active: 0 });
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<"all" | "active" | "used" | "expired">("all");

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/coupons");
      const data = await res.json();
      setCoupons(data.coupons ?? []);
      setStats(data.stats ?? { total: 0, used: 0, expired: 0, active: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const now = new Date();
  const filtered = coupons.filter((c) => {
    const expired = new Date(c.expiresAt) < now;
    const used    = !!c.usedAt;
    if (filter === "active")  return !used && !expired && c.isActive;
    if (filter === "used")    return used;
    if (filter === "expired") return !used && expired;
    return true;
  });

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-white">Coupon Analytics</h1>
          <p className="text-dark-400 text-sm mt-1">Abandoned booking recovery coupons — 5% OFF, 48h expiry</p>
        </div>
        <button onClick={load} className="btn-outline-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Tag,          label: "Total Created",  value: stats.total,   color: "text-white" },
          { icon: CheckCircle2, label: "Active",         value: stats.active,  color: "text-gold-400" },
          { icon: Clock,        label: "Used",           value: stats.used,    color: "text-green-400" },
          { icon: XCircle,      label: "Expired",        value: stats.expired, color: "text-red-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass-card rounded-xl p-5">
            <Icon size={18} className={`${color} mb-3`} />
            <p className="text-dark-400 text-xs uppercase tracking-wider">{label}</p>
            <p className={`font-display text-2xl mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["all", "active", "used", "expired"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm transition-all capitalize ${
              filter === f ? "bg-gold-500 text-black font-medium" : "bg-white/[0.04] text-dark-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Code", "Email", "Discount", "Status", "Used At", "Expires", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-dark-400 uppercase tracking-wider font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-dark-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-dark-400">No coupons found</td></tr>
              ) : filtered.map((c) => {
                const expired = new Date(c.expiresAt) < now;
                const used    = !!c.usedAt;
                const status  = used ? "used" : expired ? "expired" : "active";
                return (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3"><code className="text-gold-400 font-mono text-xs">{c.code}</code></td>
                    <td className="px-4 py-3 text-dark-300 text-xs">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-white">{c.discountPct}%</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        status === "used"    ? "bg-green-500/20 text-green-400" :
                        status === "expired" ? "bg-red-500/20 text-red-400" :
                        "bg-gold-500/20 text-gold-400"
                      }`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dark-400 text-xs">
                      {c.usedAt ? new Date(c.usedAt).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-4 py-3 text-dark-400 text-xs">{new Date(c.expiresAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3 text-dark-500 text-xs">{new Date(c.createdAt).toLocaleDateString("en-GB")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
