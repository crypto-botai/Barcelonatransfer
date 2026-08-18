import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page  = parseInt(req.nextUrl.searchParams.get("page")  ?? "1");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.abandonedBooking.findMany({
      orderBy: { createdAt: "desc" },
      skip, take: limit,
      include: { coupon: { select: { code: true, usedAt: true, expiresAt: true, discountPct: true } } },
    }),
    prisma.abandonedBooking.count(),
  ]);

  const stats = await prisma.abandonedBooking.aggregate({
    _count: { id: true },
    where: { convertedAt: { not: null } },
  });

  // The funnel behind the recoverable slice.
  //
  // An AbandonedBooking only exists where an email was captured, because the
  // record's purpose is to send a recovery offer. Most visitors leave before
  // the contact step, so counting only these rows made the page look broken
  // when in fact almost nobody was reaching the point where recovery is
  // possible. These figures come from BookingSession, which records from the
  // first interaction with the form.
  const [sessionTotal, sessionsWithEmail, sessionsConverted, byStepRaw] = await Promise.all([
    prisma.bookingSession.count(),
    prisma.bookingSession.count({ where: { email: { not: null } } }),
    prisma.bookingSession.count({ where: { converted: true } }),
    prisma.bookingSession.groupBy({ by: ["step"], _count: { step: true } }),
  ]);

  const byStep = byStepRaw
    .map((r) => ({ step: r.step, count: r._count.step }))
    .sort((a, b) => a.step - b.step);

  // Sessions that meet every condition the cron looks for but have no
  // AbandonedBooking yet. Anything other than zero means the cron has stopped.
  const ABANDON_AFTER_MINUTES = 60;
  const eligibleWhere = {
    email: { not: null },
    converted: false,
    abandonedBooking: null,
  } as const;

  const [pendingRecovery, overdueRecovery] = await Promise.all([
    prisma.bookingSession.count({
      where: {
        ...eligibleWhere,
        lastActivity: { lt: new Date(Date.now() - ABANDON_AFTER_MINUTES * 60_000) },
      },
    }),
    // Overdue means it has waited longer than the daily cron interval, which is
    // the only case that suggests the cron itself has stopped.
    prisma.bookingSession.count({
      where: {
        ...eligibleWhere,
        lastActivity: { lt: new Date(Date.now() - 25 * 3_600_000) },
      },
    }),
  ]);

  return NextResponse.json({
    items,
    total,
    converted: stats._count.id,
    funnel: {
      sessions:        sessionTotal,
      withEmail:       sessionsWithEmail,
      convertedToBook: sessionsConverted,
      byStep,
      pendingRecovery,
      overdueRecovery,
    },
  });
}
