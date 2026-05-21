import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, Calendar, CheckCircle2, Clock, Users, Car,
  ArrowUpRight, ArrowDownRight, Mail, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import AdminLiveCharts from "./AdminLiveCharts";

async function getStats() {
  const now     = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    total, pending, completed, cancelled, drivers, driversOnline,
    revenueAll, revenueMonth, revenuePrev,
    todayBookings, monthBookings, prevBookings,
    recent, newsletterSubs, abandonedCount,
    statusBreakdown,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: { status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.booking.count({ where: { status: "CANCELLED" } }),
    prisma.driver.count({ where: { status: "APPROVED" } }),
    prisma.driver.count({ where: { status: { in: ["ONLINE", "ON_RIDE"] } } }),

    prisma.booking.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: "PAID" } }),
    prisma.booking.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: "PAID", createdAt: { gte: monthStart } } }),
    prisma.booking.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: "PAID", createdAt: { gte: prevStart, lt: monthStart } } }),

    prisma.booking.count({ where: { createdAt: { gte: new Date(now.setHours(0, 0, 0, 0)) } } }),
    prisma.booking.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.booking.count({ where: { createdAt: { gte: prevStart, lt: monthStart } } }),

    prisma.booking.findMany({
      orderBy: { createdAt: "desc" }, take: 8,
      select: {
        id: true, confirmationCode: true, guestName: true, guestEmail: true,
        pickupAddress: true, dropoffAddress: true, pickupDatetime: true,
        vehicleClass: true, totalAmount: true, status: true, paymentStatus: true, createdAt: true,
      },
    }),

    prisma.newsletterSubscriber.count({ where: { isActive: true } }),
    prisma.abandonedBooking.count({ where: { convertedAt: null } }),

    prisma.booking.groupBy({ by: ["status"], _count: { id: true } }),
  ]);

  const revMonth = revenueMonth._sum.totalAmount ?? 0;
  const revPrev  = revenuePrev._sum.totalAmount  ?? 0;
  const revGrowth = revPrev > 0 ? ((revMonth - revPrev) / revPrev * 100) : 0;
  const bkGrowth  = prevBookings > 0 ? ((monthBookings - prevBookings) / prevBookings * 100) : 0;

  return {
    total, pending, completed, cancelled, drivers, driversOnline,
    totalRevenue: revenueAll._sum.totalAmount ?? 0,
    revenueMonth: revMonth, revenuePrev: revPrev, revGrowth, bkGrowth,
    todayBookings, monthBookings, prevBookings, recent,
    newsletterSubs, abandonedCount, statusBreakdown,
    convRate: total > 0 ? (completed / total * 100).toFixed(1) : "0",
  };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:         "bg-yellow-500/20 text-yellow-400",
  CONFIRMED:       "bg-blue-500/20 text-blue-400",
  DRIVER_ASSIGNED: "bg-purple-500/20 text-purple-400",
  IN_PROGRESS:     "bg-cyan-500/20 text-cyan-400",
  COMPLETED:       "bg-green-500/20 text-green-400",
  CANCELLED:       "bg-red-500/20 text-red-400",
  REFUNDED:        "bg-orange-500/20 text-orange-400",
};

export default async function AdminPage() {
  const s = await getStats();

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-white">Operations Center</h1>
          <p className="text-dark-400 mt-1 text-sm">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <Link href="/admin/bookings" className="btn-gold px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          + New Booking
        </Link>
      </div>

      {/* Primary KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Revenue",
            value: formatCurrency(s.totalRevenue),
            sub:   `${formatCurrency(s.revenueMonth)} this month`,
            icon:  TrendingUp,
            color: "text-gold-400",
            growth: s.revGrowth,
          },
          {
            label: "Total Bookings",
            value: s.total.toString(),
            sub:   `${s.monthBookings} this month`,
            icon:  Calendar,
            color: "text-blue-400",
            growth: s.bkGrowth,
          },
          {
            label: "Completed Rides",
            value: s.completed.toString(),
            sub:   `${s.convRate}% conversion rate`,
            icon:  CheckCircle2,
            color: "text-green-400",
            growth: null,
          },
          {
            label: "Active Drivers",
            value: `${s.driversOnline} / ${s.drivers}`,
            sub:   `${s.driversOnline} online now`,
            icon:  Car,
            color: "text-cyan-400",
            growth: null,
          },
        ].map(({ label, value, sub, icon: Icon, color, growth }) => (
          <div key={label} className="glass-card rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center ${color}`}>
                <Icon size={18} />
              </div>
              {growth !== null && (
                <span className={`text-xs font-medium flex items-center gap-0.5 ${growth >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {growth >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(growth).toFixed(1)}%
                </span>
              )}
            </div>
            <p className={`font-display text-2xl font-semibold ${color}`}>{value}</p>
            <p className="text-dark-400 text-xs mt-1">{label}</p>
            <p className="text-dark-600 text-[11px] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today's Bookings", value: s.todayBookings, icon: Clock,         color: "text-purple-400" },
          { label: "Pending/Confirmed", value: s.pending,      icon: AlertTriangle,  color: "text-yellow-400" },
          { label: "Newsletter Subs",  value: s.newsletterSubs, icon: Mail,          color: "text-pink-400" },
          { label: "Abandoned (Open)", value: s.abandonedCount, icon: Users,         color: "text-orange-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
            <Icon size={16} className={color} />
            <div>
              <p className={`font-display text-xl ${color}`}>{value}</p>
              <p className="text-dark-400 text-xs">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row — client component */}
      <AdminLiveCharts stats={s} />

      {/* Status breakdown + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status breakdown */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-white text-sm font-medium mb-4">Booking Status</h3>
          <div className="space-y-3">
            {s.statusBreakdown.map((sb) => {
              const pct = s.total > 0 ? (sb._count.id / s.total * 100) : 0;
              return (
                <div key={sb.status}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-dark-400">{sb.status.replace(/_/g, " ")}</span>
                    <span className="text-white">{sb._count.id}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold-500/60 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick links */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-white text-sm font-medium mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/admin/bookings",   label: "All Bookings",    color: "text-blue-400" },
              { href: "/admin/customers",  label: "Customer CRM",    color: "text-cyan-400" },
              { href: "/admin/drivers",    label: "Drivers",         color: "text-green-400" },
              { href: "/admin/newsletter", label: "Newsletter",      color: "text-pink-400" },
              { href: "/admin/abandoned",  label: "Abandoned",       color: "text-orange-400" },
              { href: "/admin/coupons",    label: "Coupons",         color: "text-gold-400" },
              { href: "/admin/email-logs", label: "Email Logs",      color: "text-purple-400" },
              { href: "/admin/settings",   label: "Settings",        color: "text-dark-300" },
            ].map(({ href, label, color }) => (
              <Link key={href} href={href}
                className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-gold-500/20 transition-all text-xs">
                <span className={`w-1.5 h-1.5 rounded-full bg-current ${color}`} />
                <span className="text-dark-300">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Today's bookings count */}
        <div className="glass-card rounded-xl p-5 flex flex-col">
          <h3 className="text-white text-sm font-medium mb-4">Platform Health</h3>
          <div className="space-y-3 flex-1">
            {[
              { label: "Conversion Rate",     value: `${s.convRate}%`,         good: parseFloat(s.convRate) > 60 },
              { label: "Revenue Growth",      value: `${s.revGrowth > 0 ? "+" : ""}${s.revGrowth.toFixed(1)}%`, good: s.revGrowth >= 0 },
              { label: "Booking Growth",      value: `${s.bkGrowth > 0 ? "+" : ""}${s.bkGrowth.toFixed(1)}%`,  good: s.bkGrowth >= 0 },
              { label: "Drivers Online",      value: `${s.driversOnline}/${s.drivers}`, good: s.driversOnline > 0 },
              { label: "Abandoned Recovery",  value: `${s.abandonedCount} open`, good: s.abandonedCount === 0 },
            ].map(({ label, value, good }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-dark-400">{label}</span>
                <span className={good ? "text-green-400" : "text-yellow-400"}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent bookings table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-white font-medium">Recent Bookings</h2>
          <Link href="/admin/bookings" className="text-gold-500 text-xs hover:text-gold-400">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Code", "Client", "Route", "Date", "Vehicle", "Amount", "Status"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.recent.map((b) => (
                <tr key={b.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-xs font-mono text-gold-500/80">{b.confirmationCode}</td>
                  <td className="py-3 px-4 text-sm text-white">{b.guestName ?? b.guestEmail ?? "—"}</td>
                  <td className="py-3 px-4 text-xs text-dark-400 max-w-[180px]">
                    <p className="truncate">{b.pickupAddress}</p>
                    {b.dropoffAddress && <p className="truncate text-dark-600">→ {b.dropoffAddress}</p>}
                  </td>
                  <td className="py-3 px-4 text-xs text-dark-400 whitespace-nowrap">
                    {new Date(b.pickupDatetime).toLocaleDateString("en-GB")}
                  </td>
                  <td className="py-3 px-4 text-xs text-dark-400">{b.vehicleClass.replace(/_/g, " ")}</td>
                  <td className="py-3 px-4 text-sm text-gold-400 font-semibold">{formatCurrency(b.totalAmount)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[b.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                      {b.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))}
              {s.recent.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-dark-400">No bookings yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
