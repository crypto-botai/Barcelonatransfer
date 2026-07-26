import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSumUpCheckout } from "@/lib/sumup";
import { finalizeSumUpPayment, markSumUpPaymentFailed } from "@/lib/payment-completion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET ?? "elite-cron-secret";

// Safety net for payment confirmation emails: the primary confirmation path is the browser
// polling /api/payments/verify on the success page, with the SumUp webhook as a second path.
// Both depend on the customer's tab staying open (or SumUp's webhook secret being configured).
// If a card requires a bank redirect the customer doesn't return from, or simply closes the tab
// right after seeing "Payment Successful", a booking can be stuck PENDING forever with a real
// charge already captured — this job re-checks those bookings against SumUp directly and
// finalizes them, so the payment confirmation email always goes out within a few minutes.
function authorise(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!authorise(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Give the live verify-poll flow a few minutes to finish on its own before we duplicate the work.
  const olderThan = new Date(Date.now() - 3 * 60_000);
  // Don't chase checkouts indefinitely — SumUp checkouts go stale long before this.
  const newerThan = new Date(Date.now() - 7 * 24 * 60 * 60_000);

  const stuck = await prisma.booking.findMany({
    where: {
      paymentStatus:   "PENDING",
      stripeSessionId: { not: null },
      createdAt:       { lt: olderThan, gt: newerThan },
    },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  const results = { checked: stuck.length, confirmed: 0, failed: 0, stillPending: 0, errors: 0 };

  for (const booking of stuck) {
    if (!booking.stripeSessionId) continue;
    try {
      const checkout = await getSumUpCheckout(booking.stripeSessionId);
      if (checkout.status === "PAID") {
        await finalizeSumUpPayment(booking.id, checkout);
        results.confirmed++;
      } else if (checkout.status === "FAILED" || checkout.status === "EXPIRED") {
        await markSumUpPaymentFailed(booking.id);
        results.failed++;
      } else {
        results.stillPending++;
      }
    } catch (err) {
      console.error("[cron/payment-reconcile]", booking.id, err);
      results.errors++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
