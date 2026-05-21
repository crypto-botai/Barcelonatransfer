"use client";

import { useEffect, useState } from "react";
import { Clock, Mail, Tag, TrendingUp, RefreshCw } from "lucide-react";

type AbandonedBooking = {
  id:          string;
  email:       string;
  name:        string | null;
  phone:       string | null;
  emailSentAt: string | null;
  convertedAt: string | null;
  createdAt:   string;
  coupon: {
    code:        string;
    discountPct: number;
    usedAt:      string | null;
    expiresAt:   string;
  } | null;
};

export default function AbandonedBookingsPage() {
  const [items,     setItems]     = useState<AbandonedBooking[]>([]);
  const [stats,     setStats]     = useState({ total: 0, converted: 0 });
  const [loading,   setLoading]   = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/abandoned-bookings");
      const data = await res.json();
      setItems(data.items ?? []);
      setStats({ total: data.total ?? 0, converted: data.converted ?? 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const convRate = stats.total > 0 ? ((stats.converted / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-white">Abandoned Bookings</h1>
          <p className="text-dark-400 text-sm mt-1">Auto-recovery system with 5% OFF coupons</p>
        </div>
        <button onClick={load} className="btn-outline-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Clock,       label: "Total Abandoned",  value: stats.total },
          { icon: TrendingUp,  label: "Converted",        value: stats.converted },
          { icon: Tag,         label: "Conversion Rate",  value: `${convRate}%` },
          { icon: Mail,        label: "Emails Sent",      value: items.filter((i) => i.emailSentAt).length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-card rounded-xl p-5">
            <Icon size={18} className="text-gold-400 mb-3" />
            <p className="text-dark-400 text-xs uppercase tracking-wider">{label}</p>
            <p className="font-display text-2xl text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Email", "Name", "Coupon", "Discount", "Sent At", "Converted", "Expires"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-dark-400 uppercase tracking-wider font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-dark-400">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-dark-400">No abandoned bookings yet</td></tr>
              ) : items.map((item) => {
                const isConverted = !!item.convertedAt;
                const isUsed      = !!item.coupon?.usedAt;
                const isExpired   = item.coupon ? new Date(item.coupon.expiresAt) < new Date() : false;

                return (
                  <tr key={item.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white">{item.email}</td>
                    <td className="px-4 py-3 text-dark-300">{item.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {item.coupon ? (
                        <code className="text-gold-400 text-xs font-mono">{item.coupon.code}</code>
                      ) : <span className="text-dark-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {item.coupon ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          isUsed ? "bg-green-500/20 text-green-400" :
                          isExpired ? "bg-red-500/20 text-red-400" :
                          "bg-gold-500/20 text-gold-400"
                        }`}>
                          {isUsed ? "Used" : isExpired ? "Expired" : `${item.coupon.discountPct}% OFF`}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-dark-400 text-xs">
                      {item.emailSentAt ? new Date(item.emailSentAt).toLocaleString("en-GB") : <span className="text-red-400">Not sent</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${isConverted ? "bg-green-500/20 text-green-400" : "bg-dark-500/20 text-dark-400"}`}>
                        {isConverted ? "✓ Converted" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dark-500 text-xs">
                      {item.coupon ? new Date(item.coupon.expiresAt).toLocaleDateString("en-GB") : "—"}
                    </td>
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
