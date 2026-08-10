import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookingStatus, DriverStatus, type RideStage } from "@prisma/client";
import { notify } from "@/lib/notifications/service";
import { canTransition, STAGE_META, RIDE_STAGES } from "@/lib/ride-stages";

export const dynamic = "force-dynamic";

const schema = z.object({
  bookingId: z.string().min(1),
  /** New granular stage. */
  stage: z.enum(["ON_THE_WAY", "ARRIVED", "WAITING_PASSENGER", "ON_BOARD", "COMPLETED"]).optional(),
  /** Legacy two-step control, kept so an older client keeps working. */
  action: z.enum(["START", "COMPLETE"]).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

/** The legacy buttons map onto the two stages that change booking status. */
const LEGACY: Record<string, RideStage> = { START: "ON_THE_WAY", COMPLETE: "COMPLETED" };

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !user?.id || user.role !== "DRIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { bookingId, lat, lng } = parsed.data;
  const stage: RideStage | undefined =
    parsed.data.stage ?? (parsed.data.action ? LEGACY[parsed.data.action] : undefined);
  if (!stage) return NextResponse.json({ error: "No stage given" }, { status: 400 });

  const driver = await prisma.driver.findUnique({
    where: { userId: user.id },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, driverId: driver.id },
    select: {
      id: true, status: true, rideStage: true, userId: true, guestPhone: true,
      pickupAddress: true, dropoffAddress: true, confirmationCode: true,
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not assigned to you" }, { status: 403 });
  }

  // Forward-only, one step at a time. A driver cannot mark a passenger on board
  // before arriving, and cannot walk back a stage the customer has already been
  // told about — the message has gone, so the timeline must match it.
  if (!canTransition(booking.rideStage, stage)) {
    return NextResponse.json(
      {
        error: booking.rideStage === stage
          ? "Already at this stage"
          : `Cannot go from ${booking.rideStage ?? "not started"} to ${stage}`,
        currentStage: booking.rideStage,
      },
      { status: 409 },
    );
  }

  const now = new Date();

  // Only the first and last stages move the booking's own status; the ones in
  // between describe where the driver is, not what the booking is.
  const statusPatch =
    stage === "ON_THE_WAY"  ? { status: BookingStatus.IN_PROGRESS, rideStartedAt: now }
  : stage === "COMPLETED"   ? { status: BookingStatus.COMPLETED, rideEndedAt: now, paymentStatus: "PAID" as const }
  : {};

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { rideStage: stage, rideStageAt: now, ...statusPatch },
    }),
    prisma.rideEvent.create({
      data: { bookingId, stage, lat: lat ?? null, lng: lng ?? null },
    }),
    prisma.driver.update({
      where: { id: driver.id },
      data: stage === "COMPLETED"
        ? { status: DriverStatus.ONLINE, totalRides: { increment: 1 } }
        : { status: DriverStatus.ON_RIDE },
    }),
  ]);

  // Tell the customer, where there is something worth telling them. notify()
  // never throws, so a messaging failure cannot leave the stage unrecorded
  // after the transaction has already committed.
  const meta = STAGE_META[stage];
  if (meta.event) {
    const base = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";
    await notify({
      event:     meta.event,
      userId:    booking.userId,
      bookingId: booking.id,
      phone:     booking.guestPhone,
      vars: {
        driver:  driver.user.name ?? "Your driver",
        pickup:  booking.pickupAddress,
        dropoff: booking.dropoffAddress,
        code:    booking.confirmationCode,
        link:    `${base}/track/${booking.confirmationCode}`,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    stage,
    stageAt: now.toISOString(),
    remaining: RIDE_STAGES.slice(RIDE_STAGES.indexOf(stage) + 1),
  });
}
