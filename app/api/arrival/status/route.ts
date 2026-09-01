import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readArrivalMany } from "@/lib/arrival-store";
import { arrivalUrl } from "@/lib/arrival-token";

export const dynamic = "force-dynamic";

/**
 * Arrival timelines for the driver and admin portals.
 *
 * Takes a list of booking ids so a dashboard showing several jobs polls once
 * rather than once per card, and returns only bookings the caller is entitled
 * to: an admin sees any, a driver sees the ones assigned to them. Without that
 * filter this would be a way for any signed-in driver to read the movements of
 * another driver's passenger.
 *
 * The passenger link is returned alongside, so a driver whose passenger says
 * they never received the email can resend it from the job card.
 */

const MAX_IDS = 50;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ arrivals: {}, links: {} });

  let allowed: string[];

  if (user.role === "ADMIN") {
    allowed = ids;
  } else if (user.role === "DRIVER") {
    const driver = await prisma.driver.findUnique({
      where:  { userId: user.id },
      select: { id: true },
    });
    if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

    const mine = await prisma.booking.findMany({
      where:  { id: { in: ids }, driverId: driver.id },
      select: { id: true },
    });
    allowed = mine.map((b) => b.id);
  } else {
    // A customer reads their own arrival through the passenger link, which
    // needs no session at all, so there is nothing for this role to do here.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const arrivals = await readArrivalMany(allowed);

  const links: Record<string, string> = {};
  for (const id of allowed) {
    try {
      links[id] = arrivalUrl(id);
    } catch {
      // NEXTAUTH_SECRET unset — the timelines are still worth returning.
    }
  }

  return NextResponse.json({ arrivals, links });
}
