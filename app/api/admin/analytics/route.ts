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
    // NOTE: DB columns are camelCase (no snake_case mapping in migrations)
    prisma.$queryRaw<{ date: string; revenue: number; bookings: number }[]>`
      SELECT
        DATE("createdAt" AT TIME ZONE 'UTC')::text as date,
        COALESCE(SUM("totalAmount") FILTER (WHERE "paymentStatus" = 'PAID'), 0)::float as revenue,
        COUNT(*)::int as bookings
      FROM bookings
      WHERE "createdAt" >= ${since}
      GROUP BY DATE("createdAt" AT TIME ZONE 'UTC')
      ORDER BY date ASC
    `,
  ]);

  // These are numbers, and are returned as numbers.
  //
  // They were built with .toFixed(1), which returns a string — including the
  // "0" fallback, so they were strings on every code path. /admin/revenue reads
  // revenueGrowth and calls .toFixed(1) on it, which a string does not have, so
  // the page threw and rendered the "Something went wrong" boundary every time
  // the data arrived. Rounding to one decimal here keeps the display identical
  // while giving both consumers a real number.
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const conversionRate = totalBookings > 0
    ? round1((completedBookings / totalBookings) * 100)
    : 0;

  const prevRevenue = revenuePrevMonth._sum.totalAmount ?? 0;
  const revenueGrowth = prevRevenue > 0
    ? round1((((revenueThisMonth._sum.totalAmount ?? 0) - prevRevenue) / prevRevenue) * 100)
    : 0;

  const bookingsGrowth = bookingsPrevMonth > 0
    ? round1(((bookingsThisMonth - bookingsPrevMonth) / bookingsPrevMonth) * 100)
    : 0;

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
