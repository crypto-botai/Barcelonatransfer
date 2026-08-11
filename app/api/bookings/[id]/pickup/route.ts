import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPickupChangedEmail, sendAdminPickupChangedAlert } from "@/lib/resend";
import { z } from "zod";
import { formatPickupDateTime } from "@/lib/datetime";

const schema = z.object({
  pickupAddress: z.string().min(3),
  pickupLat:     z.number(),
  pickupLng:     z.number(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; email?: string };
  const { id } = await params;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.errors[0].message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify ownership
  if (booking.userId !== user.id && booking.guestEmail !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (["CANCELLED", "REFUNDED", "COMPLETED"].includes(booking.status)) {
    return NextResponse.json({ error: "Cannot modify this booking" }, { status: 409 });
  }

  // 8-hour policy check (server-authoritative)
  const hoursUntilPickup = (booking.pickupDatetime.getTime() - Date.now()) / 3_600_000;
  if (hoursUntilPickup < 8) {
    return NextResponse.json({
      error: "Pickup address can only be changed more than 8 hours before transfer. Contact us via WhatsApp for urgent changes.",
      policy: "LOCKED",
      whatsappUrl: "https://wa.me/34635383712",
    }, { status: 422 });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      pickupAddress: body.pickupAddress,
      pickupLat:     body.pickupLat,
      pickupLng:     body.pickupLng,
    },
  });

  const customerEmail = booking.guestEmail ?? (session.user as { email?: string }).email;
  if (customerEmail) {
    const name = booking.guestName ?? "Valued Client";
    await Promise.allSettled([
      sendPickupChangedEmail({
        to:               customerEmail,
        name,
        confirmationCode: booking.confirmationCode,
        newPickupAddress: body.pickupAddress,
        pickupDatetime:   formatPickupDateTime(booking.pickupDatetime),
      }),
      sendAdminPickupChangedAlert({
        confirmationCode:  booking.confirmationCode,
        guestName:         name,
        guestEmail:        customerEmail,
        oldPickupAddress:  booking.pickupAddress,
        newPickupAddress:  body.pickupAddress,
        pickupDatetime:    formatPickupDateTime(booking.pickupDatetime),
      }),
    ]);
  }

  return NextResponse.json({
    success:       true,
    pickupAddress: updated.pickupAddress,
    pickupLat:     updated.pickupLat,
    pickupLng:     updated.pickupLng,
  });
}
