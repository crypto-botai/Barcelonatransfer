import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications/service";
import { formatPickupDateTime } from "@/lib/datetime";
import { BASE_URL } from "@/lib/seo";

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
      when:  formatPickupDateTime(booking.pickupDatetime),
      route,
      link:  `${BASE_URL}/track/${booking.confirmationCode}`,
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

  return NextResponse.json({ results: result.results });
}
