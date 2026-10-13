import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How long driver GPS history is kept (days). Short on purpose: it exists to answer a dispute, not to build a movement profile. */
const TRACKING_RETENTION_DAYS = 30;

/**
 * Daily retention job for location data:
 *  - ride_tracking rows (the driver's GPS trail) older than 30 days are deleted;
 *  - a passenger position left on a booking that is over, or older than six hours, is cleared;
 *  - a driver's "current position" (kept on the driver row for dispatch) that has not been updated for 24 hours is cleared, so a
 *    driver who simply stops working does not leave a last-known home or rest location on file.
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
  const drivers = await prisma.driver.updateMany({
    where: { currentLat: { not: null }, OR: [{ lastLocationAt: null }, { lastLocationAt: { lt: new Date(Date.now() - 24 * 3600_000) } }] },
    data: { currentLat: null, currentLng: null },
  });
  return NextResponse.json({ deletedTrackingRows: trail.count, clearedCustomerLocations: customer.count, clearedDriverPositions: drivers.count });
}
