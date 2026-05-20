import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name:             z.string().min(2),
  email:            z.string().email(),
  phone:            z.string().optional(),
  password:         z.string().min(8),
  whatsappNumber:   z.string().optional(),
  licenseFileUrl:   z.string().optional(),
  vehiclePermitUrl: z.string().optional(),
  vehiclePhotoFront:z.string().optional(),
  vehiclePhotoBack: z.string().optional(),
  insuranceUrl:     z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        name:         body.name,
        email:        body.email,
        phone:        body.phone,
        passwordHash,
        role:         "DRIVER",
        driver: {
          create: {
            status:           "PENDING_APPROVAL",
            whatsappNumber:   body.whatsappNumber,
            licenseFileUrl:   body.licenseFileUrl,
            vehiclePermitUrl: body.vehiclePermitUrl,
            vehiclePhotoFront:body.vehiclePhotoFront,
            vehiclePhotoBack: body.vehiclePhotoBack,
            insuranceUrl:     body.insuranceUrl,
          },
        },
      },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[driver-register]", msg, err);
    return NextResponse.json({ error: msg || "Registration failed" }, { status: 500 });
  }
}
