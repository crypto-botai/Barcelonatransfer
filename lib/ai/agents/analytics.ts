import { prisma } from "@/lib/prisma";
import { BaseAgent } from "@/lib/ai/agents/base";
import { callProvider } from "@/lib/ai/providers";
import { saveMemory } from "@/lib/ai/memory";
import { log } from "@/lib/ai/logger";

export class AnalyticsAgent extends BaseAgent {
  readonly name        = "analytics";
  readonly description = "Business analytics — daily revenue, booking trends, conversion insights.";

  async execute(): Promise<void> {
    await log({ agentId: this.agentId, taskId: this.taskId, action: "analytics_start", message: "Querying booking data" });

    const since7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      revenue7d,
      revenue30d,
      newBookings24h,
      statusBreakdown,
      vehicleBreakdown,
      abandonedCount,
      conversionData,
    ] = await Promise.all([
      prisma.booking.aggregate({
        where:  { paymentStatus: "PAID", createdAt: { gte: since7d } },
        _sum:   { totalAmount: true },
        _count: true,
        _avg:   { totalAmount: true },
      }),
      prisma.booking.aggregate({
        where:  { paymentStatus: "PAID", createdAt: { gte: since30d } },
        _sum:   { totalAmount: true },
        _count: true,
      }),
      prisma.booking.count({ where: { createdAt: { gte: since24h } } }),
      prisma.booking.groupBy({
        by:      ["status"],
        where:   { createdAt: { gte: since7d } },
        _count:  true,
      }),
      prisma.booking.groupBy({
        by:      ["vehicleClass"],
        where:   { createdAt: { gte: since7d } },
        _count:  true,
        orderBy: { _count: { vehicleClass: "desc" } },
        take:    3,
      }),
      prisma.abandonedBooking.count({ where: { createdAt: { gte: since7d } } }),
      prisma.booking.count({ where: { createdAt: { gte: since7d } } }),
    ]);

    const rev7d  = revenue7d._sum.totalAmount  ?? 0;
    const rev30d = revenue30d._sum.totalAmount ?? 0;
    const paid7d = revenue7d._count;
    const total7d = conversionData;
    const convRate = total7d > 0 ? Math.round((paid7d / total7d) * 100) : 0;
    const avgBooking = revenue7d._avg.totalAmount ?? 0;
    const topVehicle = vehicleBreakdown[0]?.vehicleClass ?? "unknown";

    this.taskOutput = { rev7d, rev30d, paid7d, total7d, convRate, avgBooking, newBookings24h, abandonedCount };

    const contextLines = [
      `7-day paid bookings: ${paid7d} | Revenue: €${rev7d.toFixed(2)} | Avg: €${avgBooking.toFixed(2)}`,
      `30-day revenue: €${rev30d.toFixed(2)}`,
      `Conversion rate: ${convRate}% (${paid7d} paid / ${total7d} total bookings)`,
      `New bookings last 24h: ${newBookings24h}`,
      `Abandoned bookings (7d): ${abandonedCount}`,
      `Top vehicle: ${topVehicle}`,
      `Status breakdown: ${statusBreakdown.map((s) => `${s.status}: ${s._count}`).join(", ")}`,
      `Vehicle breakdown: ${vehicleBreakdown.map((v) => `${v.vehicleClass}: ${v._count}`).join(", ")}`,
    ].join("\n");

    const { text, inputTokens, outputTokens, costCents } = await callProvider(
      "analytics",
      [
        {
          role:    "system",
          content: "You are a business analyst for Élite BCN, a luxury Barcelona chauffeur service. Give 3 specific, numbered, actionable insights based on the data. Focus on revenue and growth opportunities.",
        },
        { role: "user", content: contextLines },
      ],
      { maxTokens: 300 },
    );
    await this.trackSpend(costCents, inputTokens, outputTokens);

    const memContent = [
      `📊 Analytics Report`,
      ``,
      `Revenue (7d): €${rev7d.toFixed(2)} | Avg booking: €${avgBooking.toFixed(2)}`,
      `Revenue (30d): €${rev30d.toFixed(2)}`,
      `Conversion: ${convRate}% | ${paid7d}/${total7d} bookings paid`,
      `New (24h): ${newBookings24h} | Abandoned (7d): ${abandonedCount}`,
      `Top vehicle: ${topVehicle}`,
      ``,
      `AI Insights:`,
      text,
    ].join("\n");

    await saveMemory({
      agentId:    this.agentId,
      type:       "METRIC",
      title:      `Analytics — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      content:    memContent,
      tags:       ["analytics", "revenue", "bookings", "conversion"],
      importance: newBookings24h > 0 ? 5 : 4,
      ttlDays:    30,
    });

    await log({
      agentId: this.agentId,
      taskId:  this.taskId,
      action:  "analytics_complete",
      message: `7d: ${paid7d} bookings, €${rev7d.toFixed(2)} revenue, ${convRate}% conversion | 24h new: ${newBookings24h}`,
    });
  }
}
