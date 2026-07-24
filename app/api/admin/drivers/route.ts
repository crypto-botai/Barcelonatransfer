import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return session;
}

export async function GET(_req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const drivers = await prisma.driver.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      withdrawals: { orderBy: { createdAt: "desc" }, take: 5 },
      vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } },
    },
  });
  return NextResponse.json(drivers);
}

const addDriverSchema = z.object({
  name:         z.string().min(2),
  phone:        z.string().min(6),
  email:        z.string().email(),
  vehiclePlate: z.string().min(2),
  vehicleClass: z.enum(["ECONOMY","BUSINESS","LUXURY","ELECTRIC_VIP","MINIVAN","LUXURY_MINIVAN","MINIBUS"]).default("BUSINESS"),
});

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = addDriverSchema.parse(await req.json());

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

    // Generate a temporary password the admin can share with the driver
    const tempPassword = Math.random().toString(36).slice(2, 8).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const classToCapacity: Record<string, { max: number; luggage: number }> = {
      ECONOMY:        { max: 3,  luggage: 2 },
      BUSINESS:       { max: 3,  luggage: 3 },
      LUXURY:         { max: 3,  luggage: 3 },
      ELECTRIC_VIP:   { max: 3,  luggage: 3 },
      MINIVAN:        { max: 7,  luggage: 5 },
      LUXURY_MINIVAN: { max: 7,  luggage: 5 },
      MINIBUS:        { max: 16, luggage: 12 },
    };
    const cap = classToCapacity[body.vehicleClass] ?? { max: 4, luggage: 3 };

    await prisma.user.create({
      data: {
        name:               body.name,
        email:              body.email,
        phone:              body.phone,
        passwordHash,
        mustChangePassword: true,
        role:               "DRIVER",
        driver: {
          create: {
            status:        "APPROVED",
            whatsappNumber: body.phone,
            vehicles: {
              create: {
                licensePlate:  body.vehiclePlate.toUpperCase(),
                class:         body.vehicleClass as never,
                make:          "—",
                model:         "—",
                year:          new Date().getFullYear(),
                color:         "Black",
                maxPassengers: cap.max,
                maxLuggage:    cap.luggage,
                isActive:      true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ tempPassword }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/drivers POST]", msg);
    return NextResponse.json({ error: msg || "Failed to create driver" }, { status: 500 });
  }
}
