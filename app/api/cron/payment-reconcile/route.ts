import { NextRequest, NextResponse } from "next/server";
import { reconcilePendingPayments } from "@/lib/payments/reconcile";

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

  const results = await reconcilePendingPayments();
  return NextResponse.json({ ok: true, ...results });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
