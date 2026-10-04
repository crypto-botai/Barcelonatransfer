import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendAbandonedBookingEmail, sendPersonalNoteEmail } from "@/lib/resend";
import { bookingAsForm, sweepAbandoned } from "@/lib/abandoned";
import { sendSms, smsConfigured, smsSegments, toGsmSafe } from "@/lib/sms";
import { SMS_MAX_CHARS } from "@/lib/abandoned-sms";
import { toE164 } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * The office's view of everyone who nearly booked, and its ways of writing
 * to them: the automatic recovery card again, a note in the office's own
 * words, or a text message for the ones who do not use WhatsApp.
 */

/** A number is texted at most once in this long, however many times the button is pressed. */
const SMS_COOLDOWN_MS = 24 * 3600_000;
async function admin() {
  const s = await getServerSession(authOptions);
  const u = s?.user as { role?: string; name?: string } | undefined;
  return s && u?.role === "ADMIN" ? u : null;
}

export async function GET() {
  if (!await admin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const since60 = new Date(Date.now() - 60 * 86_400_000);

  const [leads, unpaid, report, smsRows] = await Promise.all([
    // Everyone who left a name and an email on the form and did not book.
    prisma.bookingSession.findMany({
      where: { email: { not: null }, converted: false, createdAt: { gt: since30 } },
      orderBy: { lastActivity: "desc" },
      take: 200,
      select: {
        sessionId: true, email: true, name: true, phone: true, step: true, formData: true, lastActivity: true, createdAt: true,
        abandonedBooking: { select: { id: true, emailSentAt: true, convertedAt: true, coupon: { select: { code: true } } } },
      },
    }),
    // Website bookings that never got paid.
    prisma.booking.findMany({
      where: { isDeleted: false, status: "PENDING", paymentStatus: "PENDING", paymentMethod: null, createdAt: { gt: since30 } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, confirmationCode: true, guestName: true, guestEmail: true, guestPhone: true,
        pickupAddress: true, dropoffAddress: true, pickupDatetime: true, passengers: true, vehicleClass: true,
        totalAmount: true, stripeSessionId: true, createdAt: true,
        pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true,
        // So the office can finish the booking without retyping it.
        luggage: true, flightNumber: true, specialRequests: true,
      },
    }),
    // Every recovery email, automatic or by hand.
    prisma.emailLog.findMany({
      where: { type: { in: ["ABANDONED", "ABANDONED_MANUAL"] }, createdAt: { gt: since60 } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, to: true, subject: true, type: true, status: true, createdAt: true, bookingId: true },
    }),
    // Every text the office has sent from here.
    prisma.activityLog.findMany({
      where: { action: "ABANDONED_SMS", createdAt: { gt: since60 } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, entityId: true, adminName: true, createdAt: true, details: true },
    }),
  ]);

  const sms = smsRows.map((r) => {
    const d = (r.details ?? {}) as { to?: string; outcome?: string; text?: string; segments?: number };
    return { id: r.id, entityId: r.entityId, to: d.to ?? "", outcome: d.outcome ?? "failed", text: d.text ?? "", segments: d.segments ?? 1, by: r.adminName ?? null, createdAt: r.createdAt };
  });

  // Which unpaid bookings have had the automatic email.
  const emailedBookingIds = new Set(report.filter((r) => r.type === "ABANDONED" && r.bookingId).map((r) => r.bookingId));
  const unpaidWithEmail = unpaid.map((b) => ({
    ...b,
    recoveryEmailedAt: report.find((r) => r.type === "ABANDONED" && r.bookingId === b.id)?.createdAt ?? null,
    emailed: emailedBookingIds.has(b.id),
  }));

  return NextResponse.json({ leads, unpaid: unpaidWithEmail, report, sms });
}

const smsSchema = z.object({
  kind: z.literal("sms"),
  phone: z.string().min(5).max(40),
  name: z.string().max(120).optional(),
  bookingId: z.string().optional(),
  sessionId: z.string().optional(),
  message: z.string().trim().min(5, "Write the message first").max(SMS_MAX_CHARS, `Keep it under ${SMS_MAX_CHARS} characters`),
});

/** A text to someone who nearly booked. */
async function sendLeadSms(raw: unknown, a: { name?: string }) {
  const parsed = smsSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  const d = parsed.data;

  if (!smsConfigured()) return NextResponse.json({ error: "Text messages are not switched on yet (the Twilio details are missing)." }, { status: 503 });

  const to = toE164(d.phone);
  if (!to) return NextResponse.json({ error: "That number has no country code, so it cannot be texted. Add it, for example +34." }, { status: 422 });

  // Once a day per number. A double click, or two people in the office, must not text a customer twice.
  const recent = await prisma.activityLog.findMany({
    where: { action: "ABANDONED_SMS", createdAt: { gt: new Date(Date.now() - SMS_COOLDOWN_MS) } },
    select: { details: true },
    take: 200,
  });
  if (recent.some((r) => { const x = (r.details ?? {}) as { to?: string; outcome?: string }; return x.to === to && x.outcome === "sent"; })) {
    return NextResponse.json({ error: "This number was already texted in the last 24 hours." }, { status: 429 });
  }

  const text = toGsmSafe(d.message).trim();
  const result = await sendSms(to, text, { bookingId: d.bookingId ?? null });

  await prisma.activityLog.create({
    data: {
      adminName: a.name ?? "Admin",
      action: "ABANDONED_SMS",
      entity: d.bookingId ? "Booking" : "BookingSession",
      entityId: d.bookingId ?? d.sessionId ?? null,
      details: { to, name: d.name ?? null, outcome: result.outcome, reason: result.reason ?? null, sid: result.id ?? null, text, segments: smsSegments(text) } as never,
    },
  }).catch((e) => console.error("[abandoned sms] audit failed:", (e as Error)?.message));

  if (result.outcome !== "sent") {
    return NextResponse.json({ error: `Not sent: ${result.reason ?? "unknown reason"}` }, { status: result.outcome === "skipped" ? 422 : 502 });
  }
  return NextResponse.json({ ok: true, to, segments: smsSegments(text) });
}

const messageSchema = z.object({
  /** Send the automatic recovery card again. */
  kind: z.enum(["recovery", "note"]),
  to: z.string().email(),
  name: z.string().min(1),
  bookingId: z.string().optional(),
  sessionId: z.string().optional(),
  subject: z.string().min(2).max(150).optional(),
  message: z.string().min(2).max(4000).optional(),
});

export async function POST(req: NextRequest) {
  const a = await admin();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = await req.json().catch(() => ({}));
  if ((raw as { kind?: string })?.kind === "sms") return sendLeadSms(raw, a);
  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  const d = parsed.data;

  try {
    // What the customer was booking, from the booking or from the session.
    let formData: Record<string, unknown> | undefined;
    let payUrl: string | undefined;
    if (d.bookingId) {
      const b = await prisma.booking.findUnique({ where: { id: d.bookingId } });
      if (b) { formData = bookingAsForm(b); if (b.stripeSessionId) payUrl = `/booking/pay/${b.stripeSessionId}?booking_id=${b.id}`; }
    } else if (d.sessionId) {
      const s = await prisma.bookingSession.findUnique({ where: { sessionId: d.sessionId } });
      if (s) formData = (s.formData ?? {}) as Record<string, unknown>;
    }

    if (d.kind === "recovery") {
      await sendAbandonedBookingEmail({ to: d.to, name: d.name, formData, payUrl, bookingId: d.bookingId });
      if (d.sessionId) await prisma.abandonedBooking.updateMany({ where: { sessionId: d.sessionId }, data: { emailSentAt: new Date() } });
    } else {
      if (!d.message) return NextResponse.json({ error: "Write the message first" }, { status: 422 });
      const site = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";
      let resumeUrl: string | null = payUrl ? `${site}${payUrl}` : null;
      if (!resumeUrl && formData?.pickupAddress) {
        const p = new URLSearchParams();
        for (const k of ["pickupAddress", "dropoffAddress", "date", "time", "passengers", "vehicleClass"]) { const v = formData[k]; if (v != null && v !== "") p.set(k, String(v)); }
        resumeUrl = `${site}/book?${p.toString()}`;
      }
      await sendPersonalNoteEmail({
        to: d.to, name: d.name,
        subject: d.subject?.trim() || "About your Elite BCN transfer",
        message: d.message, signedBy: a.name ?? null, resumeUrl, bookingId: d.bookingId,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not send" }, { status: 400 });
  }
}

/** Run the sweep now, by hand. */
export async function PUT() {
  if (!await admin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await sweepAbandoned();
  return NextResponse.json(r);
}
