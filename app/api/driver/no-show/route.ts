import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAdminWhatsApp } from "@/lib/whatsapp";
import { waitMinutes } from "@/lib/ride-stages";

export const dynamic = "force-dynamic";

const schema = z.object({
  bookingId: z.string().min(1),
  images:    z.array(z.string().min(1)).min(1).max(6),
  note:      z.string().max(500).optional(),
  lat:       z.number().min(-90).max(90).optional(),
  lng:       z.number().min(-180).max(180).optional(),
});

/**
 * Files a no-show with photographic evidence.
 *
 * A no-show is a billing dispute in waiting — the customer says nobody came,
 * the driver says they waited. Photographs from the pickup point, stamped with
 * the time and the driver's coordinates, settle it.
 *
 * The waiting time is computed here, at filing, from the driver's own Arrived
 * tap rather than read live later. Once a dispute is being argued, the number
 * needs to be the one that was true at the time.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !user?.id || user.role !== "DRIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "At least one photo is required" }, { status: 400 });
  }
  const { bookingId, images, note, lat, lng } = parsed.data;

  const driver = await prisma.driver.findUnique({
    where: { userId: user.id },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const booking = await prisma.booking.findFirst({
    where:  { id: bookingId, driverId: driver.id },
    select: { id: true, confirmationCode: true, guestName: true, pickupAddress: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not assigned to you" }, { status: 403 });
  }

  // How long they actually waited, from their own stage taps.
  const events = await prisma.rideEvent.findMany({
    where:   { bookingId, stage: { in: ["ARRIVED", "WAITING_PASSENGER"] } },
    orderBy: { createdAt: "asc" },
    select:  { stage: true, createdAt: true },
  });
  const arrivedAt = events.find((e) => e.stage === "ARRIVED")?.createdAt ?? null;
  const waited = waitMinutes(arrivedAt, new Date());

  // One report per booking. A driver adding more photos should extend the
  // existing report rather than create a second, competing account of events.
  const report = await prisma.noShowReport.upsert({
    where:  { bookingId },
    update: { images, note: note ?? null, lat: lat ?? null, lng: lng ?? null, waitedMin: waited },
    create: {
      bookingId, driverId: driver.id, images,
      note: note ?? null, lat: lat ?? null, lng: lng ?? null, waitedMin: waited,
    },
  });

  await prisma.activityLog.create({
    data: {
      action:   "NO_SHOW_REPORTED",
      entity:   "Booking",
      entityId: bookingId,
      details:  {
        driver: driver.user.name, photos: images.length,
        waitedMin: waited, code: booking.confirmationCode,
      },
    },
  }).catch(() => {});

  // The operator decides what happens next — refund, charge, reschedule — so
  // they hear about it immediately rather than at the end of the day.
  void notifyAdminWhatsApp(
    `No-show reported — ${booking.confirmationCode.slice(0, 8).toUpperCase()}\n` +
    `Driver: ${driver.user.name ?? "—"}\n` +
    `Passenger: ${booking.guestName ?? "—"}\n` +
    `Pickup: ${booking.pickupAddress}\n` +
    (waited !== null ? `Waited: ${waited} min\n` : "") +
    `${images.length} photo${images.length === 1 ? "" : "s"} attached`,
  ).catch(() => {});

  return NextResponse.json({ ok: true, waitedMin: waited, photos: report.images.length });
}
