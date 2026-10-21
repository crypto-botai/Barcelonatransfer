import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEmail, sendConfirmationTo } from "@/lib/booking-email";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** The new email for this booking. Leave out to send to the one already on it. */
  email: z.string().trim().max(254).optional(),
  /** Send the booking confirmation to that address now. */
  send: z.boolean().default(false),
});

/**
 * POST /api/admin/bookings/:id/email: ADMIN only.
 *
 * Changes the email address ON THE BOOKING (never the customer's sign-in account) and, if asked, sends the confirmation to it:
 * for the customer who gave a wrong address, or a booker who wants it sent to someone else. The change is written to the
 * activity log with the old and new address and who made it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const admin = session?.user as { id?: string; name?: string; role?: string } | undefined;
  if (!session || admin?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "That request could not be read." }, { status: 422 });

  const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true, confirmationCode: true, guestEmail: true, isDeleted: true } });
  if (!booking || booking.isDeleted) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const next = (parsed.data.email ?? "").trim().toLowerCase();
  if (parsed.data.email !== undefined && !isEmail(next)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 422 });
  const target = next || booking.guestEmail;
  if (parsed.data.send && !target) return NextResponse.json({ error: "This booking has no email address. Enter one first." }, { status: 422 });

  const changed = !!next && next !== (booking.guestEmail ?? "").toLowerCase();
  if (changed) {
    await prisma.booking.update({ where: { id }, data: { guestEmail: next } });
    await prisma.activityLog
      .create({
        data: {
          adminId: admin.id ?? "admin", adminName: admin.name ?? "Admin", action: "BOOKING_EMAIL_CHANGED", entity: "BOOKING", entityId: id,
          details: { confirmationCode: booking.confirmationCode, from: booking.guestEmail, to: next } as never,
        },
      })
      .catch(() => {});
  }

  let sent: "confirmed" | "received" | null = null;
  let sendError: string | null = null;
  if (parsed.data.send && target) {
    try {
      sent = await sendConfirmationTo(id, target);
      await prisma.activityLog
        .create({ data: { adminId: admin.id ?? "admin", adminName: admin.name ?? "Admin", action: "BOOKING_CONFIRMATION_RESENT", entity: "BOOKING", entityId: id, details: { confirmationCode: booking.confirmationCode, to: target, kind: sent } as never } })
        .catch(() => {});
    } catch (e) {
      sendError = e instanceof Error ? e.message : "The email could not be sent.";
    }
  }

  // The address is saved even if the send failed, so the office can fix the cause and press send again.
  return NextResponse.json({ id, email: target, changed, sent, sendError }, { status: sendError ? 502 : 200 });
}
