import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { icsFile } from "@/lib/calendar";

export const dynamic = "force-dynamic";

/** The booking as an .ics file, proved by its confirmation code. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const code = req.nextUrl.searchParams.get("code");
  const b = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, confirmationCode: true, pickupAddress: true, dropoffAddress: true, pickupDatetime: true, durationMin: true, isDeleted: true },
  });
  if (!b || b.isDeleted || !code || code !== b.confirmationCode) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(icsFile(b), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="elite-bcn-${b.confirmationCode}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
