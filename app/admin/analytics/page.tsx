"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { TrendingUp, Users, CheckCircle2, Calendar, RefreshCw, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const GOLD  = "#c9a84c";
const COLORS = ["#c9a84c", "#6366f1", "#22d3ee", "#4ade80", "#f87171", "#fb923c"];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

const Tip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-gold-500/20 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-dark-300 mb-1">{label ? formatDate(label) : ""}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.name === "Revenue" ? formatCurrency(p.value) : p.value}</p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [data,    setData]    = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState<"7" | "30" | "90">("30");

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

  const kpis: Record<string, unknown>      = (data?.kpis as Record<string, unknown>) ?? {};
  const daily: { date: string; revenue: number; bookings: number }[] = (data?.dailyRevenue as { date: string; revenue: number; bookings: number }[]) ?? [];
  const topRoutes: { pickupAddress: string; dropoffAddress: string; _count: { id: number }; _sum: { totalAmount: number | null } }[] = (data?.topRoutes as { pickupAddress: string; dropoffAddress: string; _count: { id: number }; _sum: { totalAmount: number | null } }[]) ?? [];
  const statusBreak: { status: string; _count: { id: number } }[] = (data?.statusBreakdown as { status: string; _count: { id: number } }[]) ?? [];
  const vehicleRev: { vehicleClass: string; _count: { id: number }; _sum: { totalAmount: number | null } }[] = (data?.vehicleRevenue as { vehicleClass: string; _count: { id: number }; _sum: { totalAmount: number | null } }[]) ?? [];

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8 max-w-[1600px] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-white">Analytics</h1>
          <p className="text-dark-400 text-sm mt-1">Business intelligence & performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {(["7", "30", "90"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-2 rounded-lg text-sm transition-all ${period === p ? "bg-gold-500 text-black font-medium" : "bg-white/[0.04] text-dark-400 hover:text-white"}`}>
                {p}d
              </button>
            ))}
          </div>
          <button onClick={() => load(period)} className="btn-outline-gold px-3 py-2 rounded-lg text-sm flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue",     value: formatCurrency(kpis.totalRevenue as number ?? 0),           icon: TrendingUp,   color: "text-gold-400",   sub: `${kpis.revenueGrowth ?? 0}% vs last month` },
          { label: "Total Bookings",    value: (kpis.totalBookings as number ?? 0).toString(),              icon: Calendar,     color: "text-blue-400",   sub: `${kpis.bookingsGrowth ?? 0}% vs last month` },
          { label: "Conversion Rate",   value: `${kpis.conversionRate ?? 0}%`,                             icon: Target,       color: "text-green-400",  sub: "completed / total" },
          { label: "Total Customers",   value: (kpis.totalCustomers as number ?? 0).toString(),             icon: Users,        color: "text-cyan-400",   sub: `+${kpis.newCustomersThisMonth ?? 0} this month` },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center ${color}`}>
                <Icon size={18} />
              </div>
            </div>
            <p className={`font-display text-2xl ${color}`}>{value}</p>
            <p className="text-dark-400 text-xs mt-1">{label}</p>
            <p className="text-dark-600 text-[11px] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue trend */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-white text-sm font-medium mb-4">Revenue Trend ({period} days)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={GOLD} stopOpacity={0.2} />
                <stop offset="95%" stopColor={GOLD} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#555" }} tickFormatter={formatDate} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "#555" }} tickFormatter={(v) => `€${v}`} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke={GOLD} strokeWidth={2.5} fill="url(#ag)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 3-column breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top routes */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-white text-sm font-medium mb-4">Top Routes</h3>
          {topRoutes.length === 0 ? (
            <p className="text-dark-400 text-sm">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topRoutes.map((r, i) => {
                const from = r.pickupAddress.split(",")[0];
                const to   = r.dropoffAddress.split(",")[0];
                return (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded bg-gold-500/15 flex items-center justify-center text-gold-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs truncate">{from} → {to}</p>
                      <p className="text-dark-400 text-[10px]">{r._count.id} bookings · {formatCurrency(r._sum.totalAmount ?? 0)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-white text-sm font-medium mb-4">Status Breakdown</h3>
          {statusBreak.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={statusBreak.map((s) => ({ name: s.status.replace(/_/g, " "), value: s._count.id }))}
                  cx="50%" cy="50%" outerRadius={65} dataKey="value" paddingAngle={2}>
                  {statusBreak.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v} bookings`]} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, color: "#888" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-dark-400 text-sm">No data yet</p>}
        </div>

        {/* Vehicle revenue */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-white text-sm font-medium mb-4">Revenue by Vehicle</h3>
          {vehicleRev.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={vehicleRev.map((v) => ({ name: v.vehicleClass.replace(/_/g, " ").slice(0, 7), value: Math.round(v._sum.totalAmount ?? 0) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#555" }} />
                <YAxis tick={{ fontSize: 9, fill: "#555" }} tickFormatter={(v) => `€${v}`} />
                <Tooltip formatter={(v) => [formatCurrency(v as number), "Revenue"]} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {vehicleRev.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-dark-400 text-sm">No data yet</p>}
        </div>

      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Abandoned Bookings", value: kpis.abandonedCount as number ?? 0,   color: "text-orange-400" },
          { label: "Newsletter Subs",    value: kpis.newsletterCount as number ?? 0,   color: "text-pink-400" },
          { label: "Emails Sent",        value: kpis.emailsSent as number ?? 0,        color: "text-blue-400" },
          { label: "Drivers Online",     value: `${kpis.driversOnline ?? 0}/${kpis.driversTotal ?? 0}`, color: "text-green-400" },
          { label: "Cancelled",          value: kpis.cancelledBookings as number ?? 0, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <p className={`font-display text-xl ${color}`}>{value}</p>
            <p className="text-dark-400 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
