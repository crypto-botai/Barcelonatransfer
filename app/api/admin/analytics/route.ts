import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const s = await getServerSession(authOptions);
  return (s?.user as { role?: string })?.role === "ADMIN";
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = req.nextUrl.searchParams.get("period") ?? "30"; // days
  const days   = Math.min(parseInt(period), 365);
  const since  = new Date(Date.now() - days * 86400000);

  const [
    totalBookings, completedBookings, cancelledBookings, pendingBookings,
    totalRevenue, revenueThisMonth, revenuePrevMonth,
    bookingsThisMonth, bookingsPrevMonth,
    recentBookings, topRoutes, statusBreakdown,
    totalCustomers, newCustomersThisMonth,
    driversOnline, driversTotal,
    abandonedCount, newsletterCount, emailsSent,
    dailyRevenue,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.booking.count({ where: { status: "CANCELLED" } }),
    prisma.booking.count({ where: { status: { in: ["PENDING", "CONFIRMED"] } } }),

    // Total revenue (paid bookings)
    prisma.booking.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: "PAID" } }),

    // This month revenue
    prisma.booking.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: "PAID", createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
    }),

    // Prev month revenue
    prisma.booking.aggregate({
      _sum: { totalAmount: true },
      where: {
        paymentStatus: "PAID",
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
          lt:  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),

    // Bookings this month
    prisma.booking.count({ where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),

    // Bookings prev month
    prisma.booking.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
          lt:  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),

    // Recent 5 bookings
    prisma.booking.findMany({
      orderBy: { createdAt: "desc" }, take: 5,
      select: {
        id: true, confirmationCode: true, guestName: true, guestEmail: true,
        pickupAddress: true, dropoffAddress: true, totalAmount: true,
        status: true, paymentStatus: true, vehicleClass: true, createdAt: true,
        pickupDatetime: true,
      },
    }),

    // Top 5 routes by count
    prisma.booking.groupBy({
      by: ["pickupAddress", "dropoffAddress"],
      _count: { id: true },
      _sum: { totalAmount: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),

    // Status breakdown
    prisma.booking.groupBy({
      by: ["status"],
      _count: { id: true },
    }),

    // Customer count
    prisma.user.count({ where: { role: "CUSTOMER" } }),

    // New customers this month
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),

    // Online drivers
    prisma.driver.count({ where: { status: { in: ["ONLINE", "ON_RIDE"] } } }),
    prisma.driver.count({ where: { status: "APPROVED" } }),

    // Abandoned bookings
    prisma.abandonedBooking.count(),
    prisma.newsletterSubscriber.count({ where: { isActive: true } }),
    prisma.emailLog.count(),

    // Daily revenue for chart (last N days)
    prisma.$queryRaw<{ date: string; revenue: number; bookings: number }[]>`
      SELECT
        DATE(created_at AT TIME ZONE 'UTC')::text as date,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'PAID'), 0)::float as revenue,
        COUNT(*)::int as bookings
      FROM bookings
      WHERE created_at >= ${since}
      GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY date ASC
    `,
  ]);

  const conversionRate = totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : "0";
  const revenueGrowth  = (revenuePrevMonth._sum.totalAmount ?? 0) > 0
    ? (((revenueThisMonth._sum.totalAmount ?? 0) - (revenuePrevMonth._sum.totalAmount ?? 0)) / (revenuePrevMonth._sum.totalAmount ?? 1) * 100).toFixed(1)
    : "0";
  const bookingsGrowth = bookingsPrevMonth > 0
    ? (((bookingsThisMonth - bookingsPrevMonth) / bookingsPrevMonth) * 100).toFixed(1)
    : "0";

  // Vehicle class revenue breakdown
  const vehicleRevenue = await prisma.booking.groupBy({
    by: ["vehicleClass"],
    _sum: { totalAmount: true },
    _count: { id: true },
    where: { paymentStatus: "PAID" },
    orderBy: { _sum: { totalAmount: "desc" } },
  });

  return NextResponse.json({
    kpis: {
      totalBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      totalRevenue:        totalRevenue._sum.totalAmount ?? 0,
      revenueThisMonth:    revenueThisMonth._sum.totalAmount ?? 0,
      revenuePrevMonth:    revenuePrevMonth._sum.totalAmount ?? 0,
      bookingsThisMonth,
      bookingsPrevMonth,
      conversionRate,
      revenueGrowth,
      bookingsGrowth,
      totalCustomers,
      newCustomersThisMonth,
      driversOnline,
      driversTotal,
      abandonedCount,
      newsletterCount,
      emailsSent,
    },
    recentBookings,
    topRoutes,
    statusBreakdown,
    vehicleRevenue,
    dailyRevenue,
  });
}
