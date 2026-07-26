import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSumUpCheckout } from "@/lib/sumup";
import { finalizeSumUpPayment, markSumUpPaymentFailed } from "@/lib/payment-completion";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

// SumUp's checkout notification payload only carries {event_type, payload:{id, checkout_reference}} —
// it is a "something changed, go check" ping, not a trusted statement of the new status. We always
// re-fetch the checkout from SumUp's API (authenticated with our own API key) before touching the DB,
// so a forged or stale webhook body can never mark a booking paid.
function verifySumUpSignature(payload: string, signature: string): boolean {
  const secret = process.env.SUMUP_WEBHOOK_SECRET;
  if (!secret) return true; // no HMAC configured — status is re-verified against SumUp's API below regardless
  if (!signature) return false;
  try {
    const expected    = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf      = Buffer.from(signature.replace("sha256=", ""), "hex");
    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const payload   = await req.text();
  const signature = req.headers.get("x-payload-signature") ?? "";

  if (!verifySumUpSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = (event.payload ?? event.data ?? event) as Record<string, unknown>;
  const checkoutId = (data.id ?? data.checkout_id) as string | undefined;
  if (!checkoutId) return NextResponse.json({ ok: true });

  const booking = await prisma.booking.findFirst({ where: { stripeSessionId: checkoutId } });
  if (!booking) return NextResponse.json({ ok: true });

  try {
    // Authoritative status straight from SumUp — never trust the webhook body's own status field.
    const checkout = await getSumUpCheckout(checkoutId);

    if (checkout.status === "PAID") {
      await finalizeSumUpPayment(booking.id, checkout);
    } else if (checkout.status === "FAILED" || checkout.status === "EXPIRED") {
      await markSumUpPaymentFailed(booking.id);
    }
  } catch (err) {
    console.error("[payments/webhook]", err);
    // Return 200 anyway — SumUp retries on non-2xx, and the reconcile cron will catch this
    // booking on its next pass regardless of whether this webhook delivery succeeds.
  }

  return NextResponse.json({ ok: true });
}
