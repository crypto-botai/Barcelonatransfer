import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * The stage-by-stage history of one journey.
 *
 * Visible to the operator, to the customer who owns the booking, and to the
 * driver who drove it — each of them has a legitimate reason to see when the
 * car set off and how long it waited. Everyone else gets a 404.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const code = req.nextUrl.searchParams.get("code");

  const booking = await prisma.booking.findUnique({
    where:  { id },
    select: { id: true, userId: true, driverId: true, confirmationCode: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  let isTheDriver = false;
  if (user?.role === "DRIVER" && user.id && booking.driverId) {
    const d = await prisma.driver.findUnique({ where: { userId: user.id }, select: { id: true } });
    isTheDriver = d?.id === booking.driverId;
  }

  const authorised =
    user?.role === "ADMIN" ||
    (user?.id && user.id === booking.userId) ||
    (code && code === booking.confirmationCode) ||
    isTheDriver;

  if (!authorised) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [events, noShow] = await Promise.all([
    prisma.rideEvent.findMany({
      where:   { bookingId: id },
      orderBy: { createdAt: "asc" },
      select:  { stage: true, createdAt: true, lat: true, lng: true },
    }),
    // Photographs only go to the operator. A customer disputing a no-show
    // should not be handed the evidence file before the operator has looked at
    // it, and the driver does not need their own submission read back.
    user?.role === "ADMIN"
      ? prisma.noShowReport.findUnique({
          where:  { bookingId: id },
          select: { images: true, note: true, lat: true, lng: true, waitedMin: true, createdAt: true },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({ events, noShow });
}
