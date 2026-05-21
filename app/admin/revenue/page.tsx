"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, CheckCircle2, RefreshCw, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const GOLD = "#c9a84c";

function Tip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-gold-500/20 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-dark-300 mb-1">{label}</p>
      <p className="text-gold-400">€{payload[0].value.toFixed(2)}</p>
    </div>
  );
}

export default function RevenuePage() {
  const [data,    setData]    = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState<"30" | "90" | "365">("30");

  const load = async (p: string) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/analytics?period=${p}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(period); }, [period]);

  const kpis  = (data?.kpis as Record<string, number>) ?? {};
  const daily = (data?.dailyRevenue as { date: string; revenue: number; bookings: number }[]) ?? [];

  const avgBookingValue = kpis.totalBookings > 0 ? (kpis.totalRevenue / kpis.totalBookings) : 0;

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8 max-w-[1400px] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-white">Revenue & Finance</h1>
          <p className="text-dark-400 text-sm mt-1">Financial overview and payment analytics</p>
        </div>
        <div className="flex gap-2">
          {(["30", "90", "365"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-2 rounded-lg text-sm transition-all ${period === p ? "bg-gold-500 text-black font-medium" : "bg-white/[0.04] text-dark-400 hover:text-white"}`}>
              {p === "365" ? "1Y" : `${p}D`}
            </button>
          ))}
          <button onClick={() => load(period)} className="btn-outline-gold px-3 py-2 rounded-lg text-sm flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue",       value: formatCurrency(kpis.totalRevenue ?? 0),          icon: TrendingUp,    color: "text-gold-400" },
          { label: "This Month",          value: formatCurrency(kpis.revenueThisMonth ?? 0),       icon: DollarSign,    color: "text-green-400", growth: kpis.revenueGrowth },
          { label: "Avg Booking Value",   value: formatCurrency(avgBookingValue),                  icon: CheckCircle2,  color: "text-blue-400" },
          { label: "Paid Bookings",       value: (kpis.completedBookings ?? 0).toString(),         icon: ArrowUpRight,  color: "text-cyan-400" },
        ].map(({ label, value, icon: Icon, color, growth }) => (
          <div key={label} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center ${color}`}>
                <Icon size={18} />
              </div>
              {growth !== undefined && (
                <span className={`text-xs font-medium ${growth >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {growth >= 0 ? "+" : ""}{growth?.toFixed(1)}%
                </span>
              )}
            </div>
            <p className={`font-display text-2xl ${color}`}>{value}</p>
            <p className="text-dark-400 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-white text-sm font-medium mb-5">Revenue Trend</h3>
        {loading ? (
          <div className="h-60 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={daily} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={GOLD} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#555" }}
                tickFormatter={(d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#555" }} tickFormatter={(v) => `€${v}`} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="revenue" stroke={GOLD} strokeWidth={2.5} fill="url(#rg)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Revenue breakdown table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-5 border-b border-white/[0.06]">
          <h3 className="text-white text-sm font-medium">Daily Revenue Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Date", "Bookings", "Revenue"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-dark-400 uppercase tracking-wider font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-dark-400">Loading…</td></tr>
              ) : daily.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-dark-400">No revenue data</td></tr>
              ) : [...daily].reverse().slice(0, 30).map((d) => (
                <tr key={d.date} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-dark-300">
                    {new Date(d.date).toLocaleDateString("en-GB", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-white">{d.bookings}</td>
                  <td className="px-4 py-3 text-gold-400 font-semibold">{formatCurrency(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
