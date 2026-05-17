import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, Calendar, CheckCircle2, Clock, Users, Car } from "lucide-react";

async function getStats() {
  const [total, pending, completed, drivers, todayBookings] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.driver.count({ where: { status: "APPROVED" } }),
    prisma.booking.findMany({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      select: { totalAmount: true },
    }),
  ]);

  const revenue = await prisma.booking.aggregate({
    _sum: { totalAmount: true },
    where: { paymentStatus: "PAID" },
  });

  return {
    total,
    pending,
    completed,
    drivers,
    todayCount: todayBookings.length,
    todayRevenue: todayBookings.reduce((s, b) => s + b.totalAmount, 0),
    totalRevenue: revenue._sum.totalAmount ?? 0,
  };
}

async function getRecentBookings() {
  return prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true, confirmationCode: true, guestName: true, guestEmail: true,
      pickupAddress: true, dropoffAddress: true, pickupDatetime: true,
      vehicleClass: true, totalAmount: true, status: true, paymentStatus: true,
    },
  });
}

export default async function AdminPage() {
  const [stats, recent] = await Promise.all([getStats(), getRecentBookings()]);

  const CARDS = [
    { icon: Calendar,     label: "Total Bookings",   value: stats.total,                   color: "text-blue-400" },
    { icon: Clock,        label: "Pending",          value: stats.pending,                 color: "text-yellow-400" },
    { icon: CheckCircle2, label: "Completed",        value: stats.completed,               color: "text-green-400" },
    { icon: TrendingUp,   label: "Total Revenue",    value: formatCurrency(stats.totalRevenue), color: "text-gold-400" },
    { icon: Calendar,     label: "Today's Bookings", value: stats.todayCount,              color: "text-purple-400" },
    { icon: Users,        label: "Active Drivers",   value: stats.drivers,                 color: "text-cyan-400" },
  ];

  const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-yellow-500/20 text-yellow-400",
    CONFIRMED: "bg-blue-500/20 text-blue-400",
    DRIVER_ASSIGNED: "bg-purple-500/20 text-purple-400",
    IN_PROGRESS: "bg-green-500/20 text-green-400",
    COMPLETED: "bg-emerald-500/20 text-emerald-400",
    CANCELLED: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-white">Dashboard</h1>
        <p className="text-dark-400 mt-1">Overview of your luxury transfer platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {CARDS.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-dark-400 text-xs uppercase tracking-wider">{label}</p>
              <Icon size={16} className={color} />
            </div>
            <p className={`font-display text-3xl ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recent bookings */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-white font-medium">Recent Bookings</h2>
          <a href="/admin/bookings" className="text-gold-500 text-xs hover:text-gold-400">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Code", "Client", "Route", "Date", "Vehicle", "Amount", "Status"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id} className="price-row border-b border-white/[0.04]">
                  <td className="py-3 px-4 text-xs font-mono text-dark-300">{b.confirmationCode}</td>
                  <td className="py-3 px-4 text-sm text-dark-200">{b.guestName ?? b.guestEmail}</td>
                  <td className="py-3 px-4 text-xs text-dark-400 max-w-[160px]">
                    <p className="truncate">{b.pickupAddress}</p>
                    <p className="truncate">→ {b.dropoffAddress}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-dark-400 whitespace-nowrap">
                    {new Date(b.pickupDatetime).toLocaleDateString("en-GB")}
                  </td>
                  <td className="py-3 px-4 text-xs text-dark-400">{b.vehicleClass.replace(/_/g, " ")}</td>
                  <td className="py-3 px-4 text-sm text-gold-400 font-semibold">{formatCurrency(b.totalAmount)}</td>
                  <td className="py-3 px-4">
                    <span className={`status-badge ${STATUS_COLORS[b.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                      {b.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
