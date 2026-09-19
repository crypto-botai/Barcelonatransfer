import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

/**
 * The office sending a notification by hand.
 *
 * To a booking: every phone that turned on ride updates for it, and the
 * account that made it, if any. To a driver: their portal and phone. Push
 * and in-app only; what the owner asked for is the buzz on the phone, and
 * email and WhatsApp have their own places.
 */
const schema = z.object({
  bookingId: z.string().optional(),
  driverId:  z.string().optional(),
  title:     z.string().min(1).max(80),
  message:   z.string().min(1).max(300),
}).refine((d) => d.bookingId || d.driverId, { message: "Choose a booking or a driver" });

export async function POST(req: NextRequest) {
  const s = await getServerSession(authOptions);
  const admin = s?.user as { role?: string; name?: string } | undefined;
  if (!s || admin?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  const d = parsed.data;

  if (d.driverId) {
    const driver = await prisma.driver.findUnique({ where: { id: d.driverId }, select: { userId: true } });
    if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    const r = await notify({ event: "OFFICE_MESSAGE", userId: driver.userId, url: "/driver", channels: ["inapp", "push"], vars: { title: d.title, text: d.message } });
    return NextResponse.json({ ok: true, push: r.results.push });
  }

  const booking = await prisma.booking.findUnique({ where: { id: d.bookingId! }, select: { id: true, userId: true } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const r = await notify({ event: "OFFICE_MESSAGE", userId: booking.userId, bookingId: booking.id, channels: ["inapp", "push"], vars: { title: d.title, text: d.message } });
  return NextResponse.json({ ok: true, push: r.results.push });
}
