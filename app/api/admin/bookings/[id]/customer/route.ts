import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** The customer account (its sign-in email) that should own the booking. */
  email: z.string().trim().email(),
});

/**
 * POST /api/admin/bookings/:id/customer
 *
 * The office giving a booking to a customer account: the booking then appears in that customer's app and dashboard, with the
 * driver's details and live tracking. Used for a booking taken without an account (by phone, WhatsApp, or as a guest) whose
 * customer has since signed up. Customer accounts only: a booking is never handed to a driver or staff account. Who did it and
 * when is written to the activity log.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const admin = session?.user as { id?: string; name?: string; role?: string } | undefined;
  if (!session || admin?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Enter the customer's email." }, { status: 422 });

  const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true, confirmationCode: true, userId: true, isDeleted: true } });
  if (!booking || booking.isDeleted) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const user = await prisma.user.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" } }, select: { id: true, email: true, role: true } });
  if (!user) return NextResponse.json({ error: "There is no account with that email." }, { status: 404 });
  if (user.role !== "CUSTOMER") return NextResponse.json({ error: "Bookings can only be given to a customer account." }, { status: 422 });

  await prisma.booking.update({ where: { id }, data: { userId: user.id } });
  await prisma.activityLog
    .create({
      data: {
        adminId: admin.id ?? "admin",
        adminName: admin.name ?? "Admin",
        action: "ASSIGN_BOOKING_TO_ACCOUNT",
        entity: "BOOKING",
        entityId: id,
        details: { confirmationCode: booking.confirmationCode, from: booking.userId, to: user.id, email: user.email } as never,
      },
    })
    .catch(() => {});

  return NextResponse.json({ id, confirmationCode: booking.confirmationCode, userId: user.id, email: user.email });
}
