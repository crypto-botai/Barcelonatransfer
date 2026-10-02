import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { candidateWebhookUrls, formParams, validTwilioSignature, SMS_STATUSES } from "@/lib/twilio-webhook";

/**
 * Twilio's delivery receipt for a text we sent.
 *
 * "Sent" in our own log only means Twilio accepted the message. Whether it
 * reached the phone is reported here, a few seconds later, as queued, sent,
 * delivered, undelivered or failed. Each report is filed against the booking
 * so the office can see what became of a text without opening the Twilio
 * console.
 *
 * Public by necessity, so it believes nothing it cannot verify: the request
 * must carry Twilio's signature for this exact URL.
 */
export async function POST(req: NextRequest) {
  const params = await formParams(req).catch(() => ({} as Record<string, string>));

  const url = new URL(req.url);
  const ok = validTwilioSignature(
    candidateWebhookUrls(`${url.pathname}${url.search}`, req.url),
    params,
    req.headers.get("x-twilio-signature"),
    process.env.TWILIO_AUTH_TOKEN,
  );
  if (!ok) return new NextResponse("Forbidden", { status: 403 });

  const bookingId = url.searchParams.get("booking");
  const status = (params.MessageStatus || params.SmsStatus || "").toLowerCase();
  const sid = params.MessageSid || params.SmsSid || "";
  if (!bookingId || !sid || !(SMS_STATUSES as readonly string[]).includes(status)) {
    // Acknowledged, so Twilio does not retry something we could never use.
    return new NextResponse(null, { status: 204 });
  }

  await prisma.activityLog.create({
    data: {
      action: "SMS_DELIVERY",
      entity: "Booking",
      entityId: bookingId,
      details: {
        sid,
        status,
        errorCode: params.ErrorCode || null,
        // The last four digits: enough to tell which number, not a copy of it.
        to: params.To ? `…${params.To.slice(-4)}` : null,
      },
    },
  }).catch((e) => console.error("[twilio/status] log failed:", (e as Error)?.message));

  return new NextResponse(null, { status: 204 });
}
