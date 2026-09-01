import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyArrivalToken } from "@/lib/arrival-token";
import { readArrival, recordArrival } from "@/lib/arrival-store";
import { PAX_STAGES, PAX_STAGE_META, furthestStage, type PaxStage } from "@/lib/arrival";
import { notifyAdminWhatsApp } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * The passenger's own endpoint.
 *
 * Deliberately unauthenticated: a passenger standing at a baggage belt is not
 * going to sign in, and requiring it is how a feature like this goes unused.
 * The signed token in the URL is the credential, and it grants exactly two
 * things — reading this one booking's arrival state, and appending a step to it.
 */

/**
 * How long after pickup the link keeps working.
 *
 * Generous, because flights are late and a passenger may reach the meeting
 * point hours after the scheduled time. Past that the journey is over and the
 * link should stop being a way to read booking details out of an old inbox.
 */
const LINK_VALID_HOURS_AFTER_PICKUP = 24;

const postSchema = z.object({
  stage: z.enum(PAX_STAGES as unknown as [PaxStage, ...PaxStage[]]),
});

async function loadBooking(token: string) {
  const bookingId = verifyArrivalToken(token);
  if (!bookingId) return null;

  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: {
      id: true, confirmationCode: true, guestName: true, flightNumber: true,
      pickupAddress: true, pickupDatetime: true, status: true,
      driver: { select: { user: { select: { name: true } } } },
    },
  });
  if (!booking) return null;

  const cutoff = new Date(
    booking.pickupDatetime.getTime() + LINK_VALID_HOURS_AFTER_PICKUP * 3_600_000,
  );
  if (Date.now() > cutoff.getTime()) return null;

  return booking;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const booking = await loadBooking(token);
  if (!booking) {
    return NextResponse.json({ error: "This link is no longer valid" }, { status: 404 });
  }

  const events = await readArrival(booking.id);
  return NextResponse.json({
    booking: {
      confirmationCode: booking.confirmationCode,
      firstName:        booking.guestName?.split(" ")[0] ?? null,
      flightNumber:     booking.flightNumber,
      pickupAddress:    booking.pickupAddress,
      pickupDatetime:   booking.pickupDatetime.toISOString(),
      driverName:       booking.driver?.user?.name ?? null,
    },
    events,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const booking = await loadBooking(token);
  if (!booking) {
    return NextResponse.json({ error: "This link is no longer valid" }, { status: 404 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  }
  const { stage } = parsed.data;

  const { events, recorded } = await recordArrival(booking.id, stage, booking.guestName);

  // The office is told once, at the step that actually changes what anyone
  // does: the passenger is walking to the car and the vehicle should move.
  // Alerting on every step would train everyone to ignore the alerts.
  if (recorded && stage === "WALKING_TO_MEETING_POINT") {
    void notifyAdminWhatsApp(
      `\u{1F6B6} ${booking.confirmationCode} — passenger walking to the meeting point.\n` +
      `${booking.guestName ?? "Passenger"}${booking.flightNumber ? ` · ${booking.flightNumber}` : ""}\n` +
      `${booking.pickupAddress}`,
    );
  }

  return NextResponse.json({
    events,
    recorded,
    signal: furthestStage(events) ? PAX_STAGE_META[furthestStage(events)!].opsNote : null,
  });
}
