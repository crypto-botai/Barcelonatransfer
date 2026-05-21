import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPickupReminder } from "@/lib/resend";

const CRON_SECRET = process.env.CRON_SECRET ?? "elite-cron-secret";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Bookings with pickup between 20h and 28h from now (send ~24h reminder)
  const from = new Date(Date.now() + 20 * 60 * 60 * 1000);
  const to   = new Date(Date.now() + 28 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      pickupDatetime: { gte: from, lte: to },
      status:         { in: ["CONFIRMED", "DRIVER_ASSIGNED"] },
      guestEmail:     { not: null },
    },
  });

  let sent = 0;
  for (const b of bookings) {
    if (!b.guestEmail || !b.guestName) continue;

    // Check not already sent (check email logs)
    const alreadySent = await prisma.emailLog.findFirst({
      where: { to: b.guestEmail, type: "REMINDER", bookingId: b.id },
    });
    if (alreadySent) continue;

    try {
      await sendPickupReminder({
        to:              b.guestEmail,
        name:            b.guestName,
        confirmationCode: b.confirmationCode,
        pickupAddress:   b.pickupAddress,
        pickupDatetime:  new Date(b.pickupDatetime).toLocaleString("en-GB"),
        vehicleClass:    b.vehicleClass,
      });
      sent++;
    } catch (err) {
      console.error("[cron/pickup-reminder]", err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
