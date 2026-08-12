import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DriverStatus } from "@prisma/client";
import { resolveBookingStatus } from "@/lib/booking-status";
import { sendDriverAssignedEmail, sendBookingCancelledEmail, sendDriverBookingDetailsEmail } from "@/lib/resend";
import { notify } from "@/lib/notifications/service";
import { formatPickupDateTime } from "@/lib/datetime";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Auth check: either a logged-in session or a confirmationCode query param
    const session     = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; role?: string } | undefined;
    const codeParam   = new URL(req.url).searchParams.get("code");

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true, userId: true,
        confirmationCode: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupDatetime: true,
        vehicleClass: true,
        passengers: true,
        luggage: true,
        totalAmount: true,
        guestEmail: true,
        guestName: true,
        status: true,
        paymentStatus: true,
        flightNumber: true,
        specialRequests: true,
        createdAt: true,
        driver: {
          select: {
            user: { select: { name: true, image: true, phone: true } },
            rating: true,
            vehicles: { take: 1, select: { make: true, model: true, licensePlate: true, color: true } },
          },
        },
        tracking: {
          orderBy: { createdAt: "asc" },
          select: { lat: true, lng: true, speed: true, heading: true, createdAt: true },
        },
      },
    });
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Access control: admin, owner, or valid confirmation code
    const isAdmin = sessionUser?.role === "ADMIN";
    const isOwner = !!sessionUser?.id && booking.userId === sessionUser.id;
    const hasCode = !!codeParam && codeParam === booking.confirmationCode;
    if (!isAdmin && !isOwner && !hasCode) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(booking);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    // Allow customers to cancel their own bookings
    if (sessionUser?.role !== "ADMIN") {
      if (body.status !== "CANCELLED") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const booking = await prisma.booking.findUnique({
        where: { id },
        select: { userId: true, status: true, guestEmail: true, guestName: true, confirmationCode: true, pickupDatetime: true, totalAmount: true },
      });
      if (!booking || booking.userId !== sessionUser?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      if (!["PENDING", "CONFIRMED"].includes(booking.status)) return NextResponse.json({ error: "Cannot cancel at this stage" }, { status: 400 });
      const updated = await prisma.booking.update({ where: { id }, data: { status: "CANCELLED" }, select: { id: true, status: true } });
      if (booking.guestEmail) {
        sendBookingCancelledEmail({
          to:               booking.guestEmail,
          name:             booking.guestName ?? "Valued Client",
          confirmationCode: booking.confirmationCode,
          pickupDatetime:   formatPickupDateTime(booking.pickupDatetime),
          totalAmount:      booking.totalAmount,
        }).catch(e => console.error("[resend] booking cancelled (customer):", e));
      }
      return NextResponse.json(updated);
    }
    const VALID_STATUSES = ["PENDING","CONFIRMED","DRIVER_ASSIGNED","IN_PROGRESS","COMPLETED","CANCELLED","REFUNDED"];
    const data: Record<string, unknown> = {};
    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      data.status = body.status;
    }
    if (body.adminNotes !== undefined) data.adminNotes = body.adminNotes;
    if (body.totalAmount !== undefined) data.totalAmount = parseFloat(body.totalAmount);
    if (body.driverAmount !== undefined) data.driverAmount = body.driverAmount === null ? null : parseFloat(body.driverAmount);
    if (body.isDeleted === true)  { data.isDeleted = true;  data.deletedAt = new Date(); }
    if (body.isDeleted === false) { data.isDeleted = false; data.deletedAt = null; }
    const current = await prisma.booking.findUnique({
      where: { id },
      select: { driverId: true, status: true, rideEndedAt: true },
    });
    const isNewDriverAssignment = Boolean(body.driverId) && body.driverId !== current?.driverId;

    if (body.driverId) {
      data.driverId = body.driverId;
      data.driverAssignedAt = new Date();
    }

    // See lib/booking-status.ts — the form posts the existing driver alongside
    // the chosen status, and treating that as a fresh assignment used to
    // overwrite whatever the admin picked.
    const nextStatus = resolveBookingStatus({
      submittedStatus:   body.status,
      submittedDriverId: body.driverId,
      currentStatus:     current?.status,
      currentDriverId:   current?.driverId,
    });
    if (nextStatus) data.status = nextStatus;

    // Completing by hand should leave the same trail as the driver's own
    // "ride completed" tap, or the journey stays open: the car is still shown
    // as on a ride and never becomes available for dispatch again.
    if (data.status === "COMPLETED" && current?.status !== "COMPLETED") {
      if (!current?.rideEndedAt) data.rideEndedAt = new Date();
      data.rideStage = "COMPLETED";
      const freeingDriverId = (body.driverId as string | undefined) ?? current?.driverId;
      if (freeingDriverId) {
        await prisma.driver.update({
          where: { id: freeingDriverId },
          data:  { status: DriverStatus.ONLINE, totalRides: { increment: 1 } },
        }).catch((e) => console.error("[bookings] freeing driver on manual completion:", e));
      }
    }
    const booking = await prisma.booking.update({
      where: { id }, data,
      include: {
        driver: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
            vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } },
          },
        },
      },
    });

    // Send notifications when driver is newly assigned
    if (isNewDriverAssignment && booking.driver) {
      const driverName  = booking.driver.user.name ?? "Your Driver";
      const driverPhone = booking.driver.user.phone ?? booking.driver.whatsappNumber ?? "";
      const driverEmail = booking.driver.user.email;
      const vehicle     = booking.driver.vehicles[0];

      // Customer: driver assigned notification
      if (booking.guestEmail) {
        sendDriverAssignedEmail({
          to:              booking.guestEmail,
          name:            booking.guestName ?? "Guest",
          confirmationCode: booking.confirmationCode,
          driverName,
          driverPhone,
          vehicleMake:     vehicle?.make  ?? "Vehicle",
          vehicleModel:    vehicle?.model ?? "",
          licensePlate:    vehicle?.licensePlate ?? "",
          pickupDatetime:  formatPickupDateTime(booking.pickupDatetime),
        }).catch(e => console.error("[resend] driver assigned (customer):", e));
      }

      // Driver: booking details notification
      if (driverEmail) {
        sendDriverBookingDetailsEmail({
          to:              driverEmail,
          driverName,
          confirmationCode: booking.confirmationCode,
          guestName:        booking.guestName ?? "Client",
          guestPhone:       booking.guestPhone ?? "",
          pickupAddress:    booking.pickupAddress,
          dropoffAddress:   booking.dropoffAddress,
          pickupDatetime:   formatPickupDateTime(booking.pickupDatetime),
          vehicleClass:     booking.vehicleClass,
          passengers:       booking.passengers,
          luggage:          booking.luggage,
          flightNumber:     booking.flightNumber,
          specialRequests:  booking.specialRequests,
          driverAmount:     booking.driverAmount,
        }).catch(e => console.error("[resend] driver booking details:", e));
      }

      // Portal + WhatsApp copy for the customer. Email is omitted because
      // sendDriverAssignedEmail above already handles it.
      await notify({
        event:     "DRIVER_ASSIGNED",
        channels:  ["inapp", "whatsapp"],
        userId:    booking.userId,
        bookingId: booking.id,
        phone:     booking.guestPhone,
        vars: {
          driver: driverName,
          code:   booking.confirmationCode,
          when:   formatPickupDateTime(booking.pickupDatetime),
          link:   `${process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info"}/track/${booking.confirmationCode}`,
        },
      });
    }

    return NextResponse.json(booking);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
