import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "DRIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId, lat, lng, speed, heading } = await req.json();

  const [tracking] = await Promise.all([
    prisma.rideTracking.create({
      data: { bookingId, lat, lng, speed, heading },
    }),
    prisma.driver.updateMany({
      where: { user: { id: (session.user as { id: string }).id } },
      data: { currentLat: lat, currentLng: lng, lastLocationAt: new Date() },
    }),
  ]);

  return NextResponse.json(tracking);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId");
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const latest = await prisma.rideTracking.findFirst({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(latest ?? {});
}
