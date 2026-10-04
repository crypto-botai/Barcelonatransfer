import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications/service";
import { formatPickupDateTime } from "@/lib/datetime";
import { BASE_URL } from "@/lib/seo";
import { confirmationVars } from "@/lib/whatsapp-events";
import { confirmationFields } from "@/lib/whatsapp-messages";
import { TEMPLATE_DEFS, renderTemplate } from "@/lib/whatsapp-template-defs";
import { loadThread, recordOutbound } from "@/lib/whatsapp-inbox-store";
import { sendWhatsAppTextResult } from "@/lib/whatsapp";
import { toE164 } from "@/lib/phone";

/**
 * Sends a booking's details to the customer's phone, on request.
 *
 * For the customers the automatic messages do not reach: the ones who booked by
 * phone or WhatsApp and were entered by hand, anyone whose payment is arranged
 * rather than taken online, and anyone who says they never got it. Admin only.
 *
 * It sends the booking confirmation, through the same notify() path the
 * automatic messages use, so the wording is the same and so is the audit entry.
 */

import { deliveryErrorText } from "@/lib/twilio-webhook";

const schema = z.object({
  channels: z.array(z.enum(["sms", "whatsapp"])).min(1).max(2),
});

/** Same check the rest of the admin booking routes make. */
async function requireAdmin() {
  const s = await getServerSession(authOptions);
  if (!s) return null;
  const u = s.user as { role?: string; id?: string; name?: string };
  if (u.role !== "ADMIN") return null;
  return u;
}

/**
 * What has become of the texts to this customer.
 *
 * The latest delivery receipt Twilio has reported for a text sent about this
 * booking, and any replies the customer has sent back, newest first.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await prisma.activityLog.findMany({
    where: { entity: "Booking", entityId: id, action: { in: ["SMS_DELIVERY", "SMS_REPLY"] } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { action: true, details: true, createdAt: true },
  });

  // One line per text, at the furthest point it reached. Receipts arrive as a
  // text moves queued, sent, delivered, so the last one per message is the state.
  const bySid = new Map<string, { status: string; errorCode: string | null; at: Date }>();
  for (const r of rows) {
    if (r.action !== "SMS_DELIVERY") continue;
    const d = r.details as { sid?: string; status?: string; errorCode?: string | null } | null;
    if (!d?.sid || !d.status || bySid.has(d.sid)) continue;
    bySid.set(d.sid, { status: d.status, errorCode: d.errorCode ?? null, at: r.createdAt });
  }

  return NextResponse.json({
    texts: [...bySid.values()].slice(0, 5).map((t) => ({
      status: t.status,
      at: t.at.toISOString(),
      problem: deliveryErrorText(t.errorCode),
    })),
    replies: rows
      .filter((r) => r.action === "SMS_REPLY")
      .slice(0, 5)
      .map((r) => ({ at: r.createdAt.toISOString(), body: (r.details as { body?: string } | null)?.body ?? "" })),
  });
}

/** A second send of the same thing inside this window is a double click. */
const DOUBLE_CLICK_MS = 60_000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose SMS, WhatsApp or both." }, { status: 422 });
  }
  const { channels } = parsed.data;

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true, confirmationCode: true, status: true, userId: true,
      pickupAddress: true, dropoffAddress: true, pickupDatetime: true, guestPhone: true,
      guestName: true, guestEmail: true, passengers: true, luggage: true, vehicleClass: true, flightNumber: true,
      specialRequests: true, totalAmount: true, paymentStatus: true, paymentMethod: true, depositAmount: true,
      balanceAmount: true, balancePaidAt: true, driverAmount: true,
    },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // A "your transfer is confirmed" text for a booking that is not confirmed is
  // worse than none.
  if (["CANCELLED", "REFUNDED"].includes(booking.status)) {
    return NextResponse.json(
      { error: "This booking is cancelled, so it would be wrong to tell the customer it is confirmed." },
      { status: 409 },
    );
  }
  if (!booking.guestPhone) {
    return NextResponse.json({ error: "This booking has no phone number." }, { status: 422 });
  }

  // Someone pressing the button twice should not text a customer twice.
  const recent = await prisma.activityLog.findMany({
    where: {
      action: "NOTIFY_BOOKING_CONFIRMED",
      entityId: booking.id,
      createdAt: { gte: new Date(Date.now() - DOUBLE_CLICK_MS) },
    },
    select: { details: true },
    take: 5,
  });
  const alreadySent = channels.filter((c) =>
    recent.some((r) => (r.details as { channels?: Record<string, string> } | null)?.channels?.[c] === "sent"),
  );
  if (alreadySent.length) {
    return NextResponse.json(
      { error: `Already sent by ${alreadySent.join(" and ")} a moment ago. Wait a minute before sending again.` },
      { status: 429 },
    );
  }

  const route = booking.dropoffAddress
    ? `${booking.pickupAddress} → ${booking.dropoffAddress}`
    : booking.pickupAddress;

  const result = await notify({
    event: "BOOKING_CONFIRMED",
    channels,
    userId: booking.userId,
    bookingId: booking.id,
    phone: booking.guestPhone,
    vars: {
      code:  booking.confirmationCode,
      route,
      link:  `${BASE_URL}/track/${booking.confirmationCode}`,
      ...confirmationVars(booking),
    },
  });

  await prisma.activityLog.create({
    data: {
      adminId: admin.id ?? "admin",
      adminName: admin.name ?? "Admin",
      action: "SEND_BOOKING_TO_PHONE",
      entity: "BOOKING",
      entityId: booking.id,
      details: {
        confirmationCode: booking.confirmationCode,
        channels: Object.fromEntries(Object.entries(result.results).map(([c, r]) => [c, r.outcome])),
      } as never,
    },
  }).catch(() => {});

  /**
   * When WhatsApp would not take the template.
   *
   * Meta refuses a business-started message until its template is approved and the
   * account has a payment method. The booking still has to reach the customer, so:
   *   1. a customer who has written to the business in the last 24 hours can be sent
   *      the confirmation as ordinary text, which needs no template, and
   *   2. for everyone else the same wording is handed back as a wa.me link, which opens
   *      WhatsApp on the office's own phone with the message ready to send.
   */
  let whatsappLink: string | null = null;
  const wa = result.results.whatsapp;
  if (channels.includes("whatsapp") && wa && wa.outcome !== "sent" && !/switched off/.test(wa.reason ?? "")) {
    const def = TEMPLATE_DEFS.find((t) => t.event === "BOOKING_CONFIRMED")!;
    const text = renderTemplate(def, confirmationFields(booking));
    const phone = toE164(booking.guestPhone);
    if (phone) {
      const thread = await loadThread(phone).catch(() => null);
      if (thread?.canReplyFreely) {
        const free = await sendWhatsAppTextResult(phone, text);
        if (free.outcome === "sent" && free.id) {
          await recordOutbound({ phone, wamid: free.id, text, by: admin.name ?? "Admin" }).catch(() => {});
          result.results.whatsapp = { outcome: "sent", reason: "sent as a normal message: the customer wrote to you in the last 24 hours" };
        }
      }
      if (result.results.whatsapp.outcome !== "sent") whatsappLink = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
    }
  }

  return NextResponse.json({ results: result.results, whatsappLink });
}
