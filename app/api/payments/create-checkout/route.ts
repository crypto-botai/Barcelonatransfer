import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSumUpCheckout, getSumUpCheckoutUrl } from "@/lib/sumup";

export async function POST(req: NextRequest) {
  try {
    const { bookingId } = await req.json();
    if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    if (booking.paymentStatus === "PAID") {
      return NextResponse.json({ error: "Already paid" }, { status: 400 });
    }

    // Use existing checkout if it exists
    if (booking.stripeSessionId) {
      return NextResponse.json({ checkoutUrl: getSumUpCheckoutUrl(booking.stripeSessionId) });
    }

    const desc = `Elite BCN: ${booking.pickupAddress} -> ${booking.dropoffAddress || "Transfer"}`.slice(0, 100);

    const checkout = await createSumUpCheckout({
      bookingId:     booking.id,
      amount:        booking.totalAmount,
      description:   desc,
      customerEmail: booking.guestEmail ?? undefined,
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data:  { stripeSessionId: checkout.id },
    });

    return NextResponse.json({ checkoutUrl: getSumUpCheckoutUrl(checkout.id) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payments/create-checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
