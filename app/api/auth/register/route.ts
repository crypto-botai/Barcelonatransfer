import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { offerToClaimBookings } from "@/lib/claim-bookings";
import { sendClaimBookingsEmail } from "@/lib/resend";

const schema = z.object({
  name:     z.string().min(2),
  email:    z.string().email(),
  phone:    z.string().optional(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, phone: body.phone, passwordHash },
    });

    // Bookings made as a guest with this email: offered by an email link, because a password sign-up does not prove the address is theirs.
    await offerToClaimBookings({ id: user.id, email: user.email, name: user.name, role: "CUSTOMER" }, sendClaimBookingsEmail);

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[register]", msg, err);
    return NextResponse.json({ error: msg || "Registration failed" }, { status: 500 });
  }
}
