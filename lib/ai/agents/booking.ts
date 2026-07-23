import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { BaseAgent } from "@/lib/ai/agents/base";
import { callProvider } from "@/lib/ai/providers";
import { saveMemory } from "@/lib/ai/memory";
import { COMPANY } from "@/lib/company-facts";
import { Resend } from "resend";

type BookingWithUser = Prisma.BookingGetPayload<{
  include: { user: { select: { id: true; createdAt: true; bookings: { select: { id: true } } } } };
}>;

const resend = new Resend(process.env.RESEND_API_KEY);

export class BookingAgent extends BaseAgent {
  readonly name        = "booking";
  readonly description = "Analyses new bookings, scores leads, auto-confirms paid bookings, alerts admin with insights.";

  async execute(): Promise<void> {
    await this.processUnanalysed();
    await this.autoConfirmPaid();
  }

  // Score and enrich bookings created in the last 24 h that haven't been analysed
  private async processUnanalysed(): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const bookings = await prisma.booking.findMany({
      where: { createdAt: { gte: since }, adminNotes: null },
      include: { user: { select: { id: true, createdAt: true, bookings: { select: { id: true } } } } },
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    for (const b of bookings) {
      await this.analyseBooking(b);
    }
  }

  private async analyseBooking(b: BookingWithUser): Promise<void> {
    const isNew       = !b.userId || (b.user?.bookings.length ?? 0) <= 1;
    const isHighValue = b.totalAmount >= 150;
    const hoursOut    = (b.pickupDatetime.getTime() - Date.now()) / 3_600_000;
    const isLastMin   = hoursOut < 4;

    const prompt = `Analyse this transfer booking for a luxury VTC company in Barcelona.

Booking:
- Route: ${b.pickupAddress} → ${b.dropoffAddress}
- Vehicle: ${b.vehicleClass}
- Amount: €${b.totalAmount.toFixed(2)}
- Pickup: ${b.pickupDatetime.toLocaleString("en-GB")}
- Passengers: ${b.passengers}
- Hours until pickup: ${hoursOut.toFixed(1)}
- New customer: ${isNew}
- Special requests: ${b.specialRequests?.slice(0, 200) ?? "none"}

Reply with JSON only:
{"leadScore":"hot|warm|cold","noShowRisk":"low|medium|high","summary":"1 sentence","action":"string"}`;

    const { text, inputTokens, outputTokens, costCents } = await callProvider(
      "booking",
      [
        { role: "system", content: "You are a booking intelligence system. Reply only with valid JSON." },
        { role: "user",   content: prompt },
      ],
      { maxTokens: 256 },
    );

    await this.trackSpend(costCents, inputTokens, outputTokens);

    let parsed: { leadScore?: string; noShowRisk?: string; summary?: string; action?: string } = {};
    try {
      parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    } catch {}

    const note = [
      `🤖 AI Analysis`,
      `Lead: ${parsed.leadScore ?? "?"} | No-show risk: ${parsed.noShowRisk ?? "?"}`,
      parsed.summary ?? "",
      parsed.action ? `Suggested: ${parsed.action}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await prisma.booking.update({ where: { id: b.id }, data: { adminNotes: note } });

    // Alert admin for hot leads or last-minute bookings
    if (parsed.leadScore === "hot" || isLastMin || isHighValue) {
      await this.sendAdminAlert(b, note);
    }

    await saveMemory({
      agentId:    this.agentId,
      type:       "OBSERVATION",
      title:      `Booking ${b.confirmationCode}`,
      content:    note,
      tags:       ["booking", parsed.leadScore ?? "unknown"],
      importance: isHighValue ? 4 : 2,
    });
  }

  // Auto-confirm bookings where payment is PAID but status is still PENDING
  private async autoConfirmPaid(): Promise<void> {
    const bookings = await prisma.booking.findMany({
      where: { paymentStatus: "PAID", status: "PENDING" },
      take: 50,
    });

    for (const b of bookings) {
      await prisma.booking.update({
        where: { id: b.id },
        data:  { status: "CONFIRMED" },
      });
      await prisma.aiLog
        .create({
          data: {
            agentId: this.agentId ?? null,
            action:  "auto_confirm",
            level:   "info",
            message: `Auto-confirmed booking ${b.confirmationCode} (payment PAID)`,
          },
        })
        .catch(() => {});
    }
  }

  private async sendAdminAlert(
    b: { confirmationCode: string; guestName?: string | null; guestEmail?: string | null; pickupAddress: string; dropoffAddress: string; totalAmount: number; pickupDatetime: Date },
    note: string,
  ): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL ?? COMPANY.email;
    await resend.emails
      .send({
        from:    process.env.RESEND_FROM ?? "Élite BCN AI <noreply@elitebcn.info>",
        to:      adminEmail,
        subject: `🔥 Priority Booking: ${b.confirmationCode}`,
        html: `<h2>Priority Booking Alert</h2>
<p><strong>Code:</strong> ${b.confirmationCode}</p>
<p><strong>Guest:</strong> ${b.guestName ?? "Guest"} (${b.guestEmail ?? ""})</p>
<p><strong>Route:</strong> ${b.pickupAddress} → ${b.dropoffAddress}</p>
<p><strong>Amount:</strong> €${b.totalAmount.toFixed(2)}</p>
<p><strong>Pickup:</strong> ${b.pickupDatetime.toLocaleString("en-GB")}</p>
<pre style="background:#f5f5f5;padding:10px">${note}</pre>
<p><a href="https://www.elitebcn.info/admin/bookings">View in admin →</a></p>`,
      })
      .catch((e) => console.error("[booking-agent] email failed:", e?.message));
  }
}
