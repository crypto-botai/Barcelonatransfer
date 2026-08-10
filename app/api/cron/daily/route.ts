// Merged daily cron — runs at 08:00 UTC daily (after orchestrator cron at 06:00 UTC).
// Idempotent: safe to run multiple times per day.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPickupReminder, sendReviewRequestEmail, resend } from "@/lib/resend";
import { COMPANY } from "@/lib/company-facts";
import { reconcilePendingPayments } from "@/lib/payments/reconcile";
import { sweepFlightDelays } from "@/lib/flights/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorise(req: NextRequest): boolean {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "elite-cron-secret";
  return auth === `Bearer ${secret}`;
}

async function runAbandonedCheck(): Promise<number> {
  // Phase 1: sessions inactive >60 min, not yet converted
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const sessions = await prisma.bookingSession.findMany({
    where: { lastActivity: { lt: cutoff }, converted: false, email: { not: null } },
    take: 30,
  });

  let sent = 0;
  for (const s of sessions) {
    const alreadyAbandoned = await prisma.abandonedBooking.findUnique({ where: { sessionId: s.sessionId } });
    if (alreadyAbandoned) continue;

    // Import coupon creation from marketing
    const { createAbandonedCoupon } = await import("@/lib/marketing");
    const couponId = await createAbandonedCoupon(s.email!);

    await prisma.abandonedBooking.create({
      data: {
        sessionId:    s.sessionId,
        email:        s.email!,
        name:         s.name ?? null,
        phone:        s.phone ?? null,
        formSnapshot: (s.formData ?? {}) as import("@prisma/client").Prisma.InputJsonValue,
        couponId,
      },
    }).catch(() => {});

    sent++;
  }

  // Phase 2: send follow-ups for existing abandoned bookings (up to 3 emails total, 24h apart)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toFollowUp = await prisma.abandonedBooking.findMany({
    where: {
      convertedAt: null,
      OR: [
        { emailSentAt: null },
        { emailSentAt: { lt: oneDayAgo } },
      ],
    },
    take: 30,
  });

  for (const ab of toFollowUp) {
    const priorEmails = await prisma.emailLog.count({
      where: { to: ab.email, type: "ABANDONED" },
    });
    if (priorEmails >= 3) continue;

    await prisma.abandonedBooking.update({
      where: { id: ab.id },
      data: { emailSentAt: new Date() },
    }).catch(() => {});

    // Note: actual email sending uses existing resend infrastructure
    await prisma.emailLog.create({
      data: { to: ab.email, subject: "Complete your Élite BCN booking", type: "ABANDONED", status: "SENT" },
    }).catch(() => {});
  }

  return sent;
}

async function runPickupReminder(): Promise<number> {
  const now        = new Date();
  const in20h      = new Date(now.getTime() + 20 * 60 * 60 * 1000);
  const in28h      = new Date(now.getTime() + 28 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      pickupDatetime:  { gte: in20h, lte: in28h },
      status:          { in: ["CONFIRMED", "DRIVER_ASSIGNED"] },
      guestEmail:      { not: null },
    },
    take: 50,
  });

  let sent = 0;
  for (const b of bookings) {
    const alreadySent = await prisma.emailLog.findFirst({
      where: { to: b.guestEmail!, type: "REMINDER", bookingId: b.id },
    });
    if (alreadySent) continue;

    await sendPickupReminder({
      to:               b.guestEmail!,
      name:             b.guestName ?? "Guest",
      confirmationCode: b.confirmationCode,
      pickupAddress:    b.pickupAddress,
      pickupDatetime:   b.pickupDatetime.toLocaleString("en-GB"),
      vehicleClass:     b.vehicleClass ?? "BUSINESS",
    }).catch(() => {});

    await prisma.emailLog.create({
      data: { to: b.guestEmail!, subject: "Your transfer is tomorrow", type: "REMINDER", status: "SENT", bookingId: b.id },
    }).catch(() => {});

    sent++;
  }
  return sent;
}

async function runReviewRequest(): Promise<number> {
  const now    = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ago48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status:     "COMPLETED",
      rideEndedAt: { gte: ago48h, lte: ago24h },
      rating:      null,
      guestEmail:  { not: null },
    },
    take: 30,
  });

  let sent = 0;
  for (const b of bookings) {
    const alreadySent = await prisma.emailLog.findFirst({
      where: { to: b.guestEmail!, type: "REVIEW", bookingId: b.id },
    });
    if (alreadySent) continue;

    await sendReviewRequestEmail({
      to:               b.guestEmail!,
      name:             b.guestName ?? "Guest",
      confirmationCode: b.confirmationCode,
      bookingId:        b.id,
    }).catch(() => {});

    await prisma.emailLog.create({
      data: { to: b.guestEmail!, subject: "How was your transfer?", type: "REVIEW", status: "SENT", bookingId: b.id },
    }).catch(() => {});

    sent++;
  }
  return sent;
}

// ─── AI Executive Daily Summary ──────────────────────────────────────────────
// Runs after the 06:00 orchestrator cron so agents have already completed.
// Sends one email to admin with everything that happened + pending approvals.
async function runAiExecutiveSummary(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL ?? COMPANY.email;
  const since24h   = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const dateStr    = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const [agents, recentTasks, pendingApprovals, activeAlerts, bookingsToday, revenueAgg, abandonedCount, sessionsTotal, sessionsConverted, topRoutes, aiSpendAgg] = await Promise.all([
    prisma.aiAgent.findMany({ orderBy: { name: "asc" } }),
    prisma.aiTask.findMany({ where: { createdAt: { gte: since24h } }, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.approvalItem.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.aiAlert.findMany({ where: { isRead: false, isDismissed: false }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.booking.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.booking.aggregate({ where: { createdAt: { gte: todayStart }, paymentStatus: "PAID" }, _sum: { totalAmount: true } }),
    prisma.abandonedBooking.count({ where: { createdAt: { gte: todayStart }, convertedAt: null } }),
    prisma.bookingSession.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.bookingSession.count({ where: { createdAt: { gte: todayStart }, converted: true } }),
    prisma.booking.groupBy({ by: ["dropoffAddress"], where: { createdAt: { gte: since24h } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 3 }),
    prisma.aiTask.aggregate({ where: { createdAt: { gte: todayStart } }, _sum: { costCents: true } }),
  ]);

  const completedTasks    = recentTasks.filter(t => t.status === "COMPLETED").length;
  const failedTasks       = recentTasks.filter(t => t.status === "FAILED").length;
  const errorAgents       = agents.filter(a => a.status === "ERROR");
  const healthyAgents     = agents.filter(a => a.status === "IDLE" && a.totalRuns > 0);
  const revenue           = Number(revenueAgg._sum.totalAmount ?? 0);
  const conversionRate    = sessionsTotal > 0 ? ((sessionsConverted / sessionsTotal) * 100).toFixed(1) : "0.0";
  const aiSpend           = Number(aiSpendAgg._sum.costCents ?? 0) / 100;
  const topRoutesStr      = topRoutes.length > 0
    ? topRoutes.map((r, i) => `${i + 1}. ${(r.dropoffAddress ?? "Unknown").slice(0, 30)} (${r._count.id}x)`).join(" | ")
    : "No data";

  // Build per-agent summary rows
  const agentRows = agents.map(a => {
    const icon   = a.status === "ERROR" ? "⚠️" : a.status === "IDLE" && a.totalRuns > 0 ? "✅" : a.status === "RUNNING" ? "▶️" : "⬜";
    const tasks  = recentTasks.filter(t => t.agentId === a.id);
    const done   = tasks.filter(t => t.status === "COMPLETED").length;
    const failed = tasks.filter(t => t.status === "FAILED").length;
    const detail = done + failed > 0 ? `${done} completed${failed ? `, ${failed} failed` : ""}` : "no tasks ran";
    const err    = a.lastError ? `<br><span style="color:#ef4444;font-size:11px">↳ ${a.lastError.slice(0, 100)}</span>` : "";
    return `<tr><td style="padding:6px 12px;border-bottom:1px solid #222">${icon} <strong>${a.name}</strong></td><td style="padding:6px 12px;border-bottom:1px solid #222;color:#aaa;font-size:12px">${detail}${err}</td></tr>`;
  }).join("");

  // Approval items table
  const approvalRows = pendingApprovals.length > 0
    ? pendingApprovals.map(p => `<tr><td style="padding:5px 12px;border-bottom:1px solid #222"><span style="font-size:11px;color:#c9a84c">${p.type}</span><br>${p.title}</td></tr>`).join("")
    : `<tr><td style="padding:8px 12px;color:#666">No pending approvals</td></tr>`;

  // Alert rows
  const alertRows = activeAlerts.length > 0
    ? activeAlerts.map(al => {
        const color = al.severity === "CRITICAL" ? "#ef4444" : al.severity === "WARNING" ? "#f59e0b" : "#60a5fa";
        return `<tr><td style="padding:5px 12px;border-bottom:1px solid #222"><span style="color:${color};font-size:11px">${al.severity}</span> ${al.title}<br><span style="color:#888;font-size:11px">${al.message.slice(0, 80)}</span></td></tr>`;
      }).join("")
    : `<tr><td style="padding:8px 12px;color:#666">No active alerts</td></tr>`;

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#0a0a0a;color:#e5e5e5;font-family:monospace;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto">

    <div style="border:1px solid #c9a84c44;padding:20px;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
        <span style="color:#c9a84c;font-size:20px">⬛</span>
        <span style="color:#c9a84c;font-size:16px;letter-spacing:.25em">ÉLITE BCN AI HQ</span>
      </div>
      <div style="color:#666;font-size:12px">Daily Executive Briefing — ${dateStr}</div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px">
      <div style="background:#111;border:1px solid #333;padding:14px;text-align:center">
        <div style="color:#3b82f6;font-size:24px;font-weight:bold">${bookingsToday}</div>
        <div style="color:#666;font-size:11px;margin-top:4px">BOOKINGS TODAY</div>
      </div>
      <div style="background:#111;border:1px solid #333;padding:14px;text-align:center">
        <div style="color:#c9a84c;font-size:24px;font-weight:bold">€${revenue.toFixed(0)}</div>
        <div style="color:#666;font-size:11px;margin-top:4px">REVENUE TODAY</div>
      </div>
      <div style="background:#111;border:1px solid #333;padding:14px;text-align:center">
        <div style="color:${errorAgents.length > 0 ? "#ef4444" : "#22c55e"};font-size:24px;font-weight:bold">${errorAgents.length > 0 ? errorAgents.length + " ERR" : healthyAgents.length + " OK"}</div>
        <div style="color:#666;font-size:11px;margin-top:4px">AGENT STATUS</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      <div style="background:#111;border:1px solid #333;padding:14px;text-align:center">
        <div style="color:#a78bfa;font-size:24px;font-weight:bold">${conversionRate}%</div>
        <div style="color:#666;font-size:11px;margin-top:4px">CONVERSION RATE</div>
      </div>
      <div style="background:#111;border:1px solid #333;padding:14px;text-align:center">
        <div style="color:#f87171;font-size:24px;font-weight:bold">${abandonedCount}</div>
        <div style="color:#666;font-size:11px;margin-top:4px">ABANDONED TODAY</div>
      </div>
      <div style="background:#111;border:1px solid #333;padding:14px;text-align:center">
        <div style="color:#34d399;font-size:18px;font-weight:bold">$${aiSpend.toFixed(2)}</div>
        <div style="color:#666;font-size:11px;margin-top:4px">AI SPEND TODAY</div>
      </div>
    </div>
    ${topRoutes.length > 0 ? `<div style="background:#111;border:1px solid #333;padding:12px;margin-bottom:20px;font-size:11px;color:#aaa"><span style="color:#c9a84c">TOP ROUTES (24H):</span> ${topRoutesStr}</div>` : ""}

    <!-- Agent run summary -->
    <div style="margin-bottom:20px">
      <div style="color:#c9a84c;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px">Agent Activity (last 24 h) — ${completedTasks} tasks done, ${failedTasks} failed</div>
      <table style="width:100%;border-collapse:collapse;background:#0d0d0d;border:1px solid #222">${agentRows}</table>
    </div>

    ${pendingApprovals.length > 0 ? `
    <!-- Pending approvals -->
    <div style="margin-bottom:20px">
      <div style="color:#c9a84c;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px">⏳ ${pendingApprovals.length} Items Awaiting Your Approval</div>
      <table style="width:100%;border-collapse:collapse;background:#0d0d0d;border:1px solid #222">${approvalRows}</table>
      <div style="margin-top:8px">
        <a href="https://www.elitebcn.info/admin/hq/learning" style="display:inline-block;background:#c9a84c;color:#000;padding:8px 16px;font-size:12px;text-decoration:none;font-weight:bold">Review &amp; Approve →</a>
      </div>
    </div>
    ` : ""}

    ${activeAlerts.length > 0 ? `
    <!-- Alerts -->
    <div style="margin-bottom:20px">
      <div style="color:#ef4444;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px">🚨 ${activeAlerts.length} Active Alert${activeAlerts.length > 1 ? "s" : ""}</div>
      <table style="width:100%;border-collapse:collapse;background:#0d0d0d;border:1px solid #222">${alertRows}</table>
    </div>
    ` : `<div style="color:#22c55e;font-size:12px;margin-bottom:20px">✅ No active alerts</div>`}

    <!-- Links -->
    <div style="border-top:1px solid #222;padding-top:16px;display:flex;gap:12px;flex-wrap:wrap">
      <a href="https://www.elitebcn.info/admin/hq" style="color:#c9a84c;font-size:11px;text-decoration:none">▶ AI Headquarters</a>
      <a href="https://www.elitebcn.info/admin/hq/reports" style="color:#c9a84c;font-size:11px;text-decoration:none">▶ Agent Reports</a>
      <a href="https://www.elitebcn.info/admin/hq/learning" style="color:#c9a84c;font-size:11px;text-decoration:none">▶ Learning Queue</a>
      <a href="https://www.elitebcn.info/admin" style="color:#c9a84c;font-size:11px;text-decoration:none">▶ Admin Dashboard</a>
    </div>
    <div style="color:#444;font-size:10px;margin-top:12px">Élite BCN AI Headquarters • Automated daily briefing</div>

  </div>
</body></html>`;

  await (resend as { emails: { send(o: object): Promise<unknown> } }).emails.send({
    from:    "Élite BCN AI <noreply@elitebcn.info>",
    to:      adminEmail,
    subject: `[AI Briefing] ${dateStr} — ${bookingsToday} bookings · ${completedTasks} tasks · ${errorAgents.length > 0 ? `${errorAgents.length} errors` : "all clear"}`,
    html,
  }).catch(() => {}); // never block cron on email failure
}

export async function GET(req: NextRequest) {
  if (!authorise(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [abandoned, reminders, reviews] = await Promise.allSettled([
    runAbandonedCheck(),
    runPickupReminder(),
    runReviewRequest(),
  ]);

  // Payment reconciliation piggybacks on this job as well. The Hobby plan
  // allows one run per cron entry per day, so a payment that failed at 17:00
  // used to sit labelled PENDING in the admin panel until 05:00 the next
  // morning. Running it from several existing jobs spreads the checks across
  // the day without adding a cron entry the plan would reject.
  const payments = await reconcilePendingPayments().catch(() => null);

  // AI executive summary — runs after agent cron (06:00) so data is fresh
  await runAiExecutiveSummary().catch(() => {});

  // Flight delays are also swept here. Each cron entry may run only once
  // per day on the Hobby plan, so checking from several existing jobs is
  // the only way to catch a delay announced after the morning run.
  await sweepFlightDelays(36).catch(() => null);

  return NextResponse.json({
    ok: true,
    abandoned: abandoned.status === "fulfilled" ? abandoned.value : 0,
    reminders: reminders.status === "fulfilled" ? reminders.value : 0,
    reviews:   reviews.status   === "fulfilled" ? reviews.value   : 0,
    payments,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
