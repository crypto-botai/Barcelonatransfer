import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { type VehicleClass } from "@/types";
import { sendBookingConfirmation, sendAdminNewBookingAlert } from "@/lib/resend";

async function requireAdmin() {
  const s = await getServerSession(authOptions);
  if (!s) return null;
  const u = s.user as { role?: string; id?: string; name?: string };
  if (u.role !== "ADMIN") return null;
  return u;
}

function generateCode(phone: string): string {
  const digits  = phone.replace(/\D/g, "").slice(-6).padStart(6, "0");
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const suffix  = Array.from({ length: 2 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `${digits}${suffix}`;
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const search = req.nextUrl.searchParams.get("q");
  const limit  = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "100"), 500);

  const bookings = await prisma.booking.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(search ? {
        OR: [
          { confirmationCode: { contains: search, mode: "insensitive" } },
          { guestName:        { contains: search, mode: "insensitive" } },
          { guestEmail:       { contains: search, mode: "insensitive" } },
          { guestPhone:       { contains: search, mode: "insensitive" } },
          { pickupAddress:    { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      driver: { include: { user: { select: { name: true, phone: true } } } },
      user:   { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(bookings);
}

const createSchema = z.object({
  guestName:       z.string().min(2),
  guestEmail:      z.string().email(),
  guestPhone:      z.string().min(6),
  pickupAddress:   z.string().min(3),
  pickupLat:       z.number().default(41.3851),
  pickupLng:       z.number().default(2.1734),
  dropoffAddress:  z.string().default(""),
  dropoffLat:      z.number().default(0),
  dropoffLng:      z.number().default(0),
  pickupDatetime:  z.string(),
  passengers:      z.number().int().min(1).default(1),
  luggage:         z.number().int().min(0).default(0),
  vehicleClass:    z.string().default("BUSINESS"),
  flightNumber:    z.string().optional(),
  specialRequests: z.string().optional(),
  totalAmount:     z.number().min(0),
  paymentStatus:   z.enum(["PENDING", "PAID", "FAILED"]).default("PENDING"),
  notes:           z.string().optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body    = createSchema.parse(await req.json());
    const pickup  = new Date(body.pickupDatetime);

    const booking = await prisma.booking.create({
      data: {
        guestName:       body.guestName,
        guestEmail:      body.guestEmail,
        guestPhone:      body.guestPhone,
        pickupAddress:   body.pickupAddress,
        pickupLat:       body.pickupLat,
        pickupLng:       body.pickupLng,
        dropoffAddress:  body.dropoffAddress,
        dropoffLat:      body.dropoffLat,
        dropoffLng:      body.dropoffLng,
        pickupDatetime:  pickup,
        passengers:      body.passengers,
        luggage:         body.luggage,
        vehicleClass:    body.vehicleClass as VehicleClass,
        flightNumber:    body.flightNumber,
        specialRequests: body.specialRequests,
        adminNotes:      body.notes,
        baseFare:        body.totalAmount,
        totalAmount:     body.totalAmount,
        confirmationCode: generateCode(body.guestPhone),
        status:          "CONFIRMED",
        paymentStatus:   body.paymentStatus,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        adminId:   admin.id,
        adminName: admin.name ?? "Admin",
        action:    "CREATE",
        entity:    "BOOKING",
        entityId:  booking.id,
        details:   { confirmationCode: booking.confirmationCode, amount: body.totalAmount } as never,
      },
    }).catch(() => {});

    // Notify customer
    sendBookingConfirmation({
      to:               body.guestEmail,
      name:             body.guestName,
      confirmationCode: booking.confirmationCode,
      pickupAddress:    body.pickupAddress,
      dropoffAddress:   body.dropoffAddress || "",
      pickupDatetime:   pickup.toLocaleString("en-GB"),
      vehicleClass:     body.vehicleClass,
      totalAmount:      body.totalAmount,
      passengers:       body.passengers,
      bookingId:        booking.id,
    }).catch(e => console.error("[resend] admin create booking confirmation:", e));

    // Notify admin panel (useful if another admin created it)
    sendAdminNewBookingAlert({
      confirmationCode: booking.confirmationCode,
      guestName:        body.guestName,
      guestEmail:       body.guestEmail,
      pickupAddress:    body.pickupAddress,
      dropoffAddress:   body.dropoffAddress || "",
      pickupDatetime:   pickup.toLocaleString("en-GB"),
      vehicleClass:     body.vehicleClass,
      totalAmount:      body.totalAmount,
    }).catch(() => {});

    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
