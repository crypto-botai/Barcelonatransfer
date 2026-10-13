import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How long driver GPS history is kept (days). Short on purpose: it exists to answer a dispute, not to build a movement profile. */
const TRACKING_RETENTION_DAYS = 30;

/**
 * Daily retention job for location data:
 *  - ride_tracking rows (the driver's GPS trail) older than 30 days are deleted;
 *  - a passenger position left on a booking that is over, or older than six hours, is cleared.
 * Guarded by the same CRON_SECRET as the other cron routes.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trail = await prisma.rideTracking.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - TRACKING_RETENTION_DAYS * 86_400_000) } } });
  const customer = await prisma.booking.updateMany({
    where: { customerLocatedAt: { not: null }, OR: [{ status: { in: ["COMPLETED", "CANCELLED", "REFUNDED"] } }, { customerLocatedAt: { lt: new Date(Date.now() - 6 * 3600_000) } }] },
    data: { customerLat: null, customerLng: null, customerLocatedAt: null },
  });
  return NextResponse.json({ deletedTrackingRows: trail.count, clearedCustomerLocations: customer.count });
}
