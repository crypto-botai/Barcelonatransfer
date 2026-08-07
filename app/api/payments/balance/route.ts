import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBalancePayment } from "@/lib/deposits";

export const dynamic = "force-dynamic";

const schema = z.object({
  bookingId: z.string().min(1),
  code:      z.string().min(1).optional(),
});

/**
 * Payment link for the outstanding balance on a deposit booking.
 *
 * Authorised by the confirmation code or a session, the same as the invoice and
 * tracking routes — the customer paying the balance is frequently a guest with
 * no account.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { bookingId, code } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: { id: true, userId: true, confirmationCode: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  const authorised =
    (code && code === booking.confirmationCode) ||
    (user?.id && user.id === booking.userId) ||
    user?.role === "ADMIN";

  if (!authorised) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const state = await getBalancePayment(bookingId);
    if (!state.due) return NextResponse.json({ due: false, reason: state.reason });
    return NextResponse.json({ due: true, amount: state.amount, url: state.checkoutUrl });
  } catch (e) {
    console.error("[payments/balance]", e);
    return NextResponse.json({ error: "Could not create the payment link" }, { status: 500 });
  }
}
