"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";

type DayData  = { date: string; revenue: number; bookings: number };
type ChartData = { dailyRevenue: DayData[]; vehicleRevenue: { vehicleClass: string; _sum: { totalAmount: number | null }; _count: { id: number } }[] };

const GOLD  = "#c9a84c";
const DARK  = "#1a1a1a";

function formatCur(n: number) {
  return `€${n.toFixed(0)}`;
}

function formatDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-gold-500/20 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-dark-300 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-gold-400">{p.name}: {p.name === "Revenue" ? formatCur(p.value) : p.value}</p>
      ))}
    </div>
  );
};

const VEHICLE_COLORS = ["#c9a84c", "#d4b96b", "#b8983b", "#e5c87e", "#a07830", "#f0d890"];

export default function AdminLiveCharts({ stats }: { stats: { monthBookings: number; revGrowth: number } }) {
  const [data,    setData]    = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState<"7" | "30" | "90">("30");

  const loadData = async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?period=${p}`);
      const json = await res.json();
      setData({ dailyRevenue: json.dailyRevenue ?? [], vehicleRevenue: json.vehicleRevenue ?? [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(period); }, [period]);

  const totalRevInPeriod = data?.dailyRevenue.reduce((s, d) => s + (d.revenue ?? 0), 0) ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Revenue area chart */}
      <div className="glass-card rounded-xl p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white text-sm font-medium">Revenue & Bookings</h3>
            {!loading && <p className="text-dark-400 text-xs mt-0.5">{formatCur(totalRevInPeriod)} in this period</p>}
          </div>
          <div className="flex gap-1.5">
            {(["7", "30", "90"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs transition-all ${period === p ? "bg-gold-500 text-black font-medium" : "bg-white/[0.04] text-dark-400 hover:text-white"}`}>
                {p}d
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="w-6 h-6 border border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data?.dailyRevenue ?? []} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={GOLD} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666" }} tickFormatter={formatDate} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#666" }} tickFormatter={formatCur} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={GOLD} strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Vehicle revenue breakdown */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-white text-sm font-medium mb-4">Revenue by Vehicle</h3>
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="w-6 h-6 border border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
          </div>
        ) : data?.vehicleRevenue.length ? (
          <>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={data.vehicleRevenue.map((v) => ({
                    name: v.vehicleClass.replace(/_/g, " "),
                    value: v._sum.totalAmount ?? 0,
                  }))}
                  cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                  paddingAngle={3} dataKey="value"
                >
                  {data.vehicleRevenue.map((_, i) => (
                    <Cell key={i} fill={VEHICLE_COLORS[i % VEHICLE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCur(v as number)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {data.vehicleRevenue.slice(0, 4).map((v, i) => (
                <div key={v.vehicleClass} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: VEHICLE_COLORS[i % VEHICLE_COLORS.length] }} />
                    <span className="text-dark-400">{v.vehicleClass.replace(/_/g, " ")}</span>
                  </div>
                  <span className="text-dark-200">{formatCur(v._sum.totalAmount ?? 0)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-48 flex items-center justify-center text-dark-400 text-sm">No revenue data yet</div>
        )}
      </div>

      {/* Bookings bar chart */}
      <div className="glass-card rounded-xl p-5 lg:col-span-3">
        <h3 className="text-white text-sm font-medium mb-4">Daily Bookings</h3>
        {loading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="w-6 h-6 border border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data?.dailyRevenue ?? []} margin={{ top: 0, right: 5, bottom: 0, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#555" }} tickFormatter={formatDate} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#555" }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="bookings" name="Bookings" fill={GOLD} opacity={0.6} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
