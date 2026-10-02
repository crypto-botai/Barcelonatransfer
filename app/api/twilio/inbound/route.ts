import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/whatsapp";
import { COMPANY } from "@/lib/company-facts";
import { candidateWebhookUrls, formParams, validTwilioSignature } from "@/lib/twilio-webhook";

/**
 * A customer replying to one of our texts.
 *
 * The text says not to reply, and people reply anyway. Without this a reply
 * goes to a number nobody reads, at the moment someone most wants an answer: a
 * driver who is not where they were told, a flight that has changed. So the
 * reply is filed against the customer's latest booking and forwarded to the
 * office, and the customer is told once where a person can be reached.
 *
 * Twilio is pointed here from the number's settings: Messaging, "A message
 * comes in", webhook, HTTP POST.
 */

/** Words carriers and Twilio treat as opt-out, opt-in or help. Never answered or forwarded. */
const KEYWORDS = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|start|unstop|yes|help|info)\s*$/i;

const AUTO_REPLY_EVERY_MS = 24 * 3600_000;

function twiml(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response/>`;
  return new NextResponse(body, { status: 200, headers: { "Content-Type": "text/xml" } });
}

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

  const from = (params.From || "").trim();
  const body = (params.Body || "").trim().slice(0, 600);
  if (!from || !body) return twiml();

  // STOP and the like are Twilio's to handle. Answering one would be a text
  // to someone who just asked for none.
  if (KEYWORDS.test(body)) return twiml();

  // Whose reply is it: the latest booking made with this number.
  const booking = await prisma.booking.findFirst({
    where: { guestPhone: from, isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, confirmationCode: true, guestName: true, pickupAddress: true, pickupDatetime: true },
  }).catch(() => null);

  await prisma.activityLog.create({
    data: {
      action: "SMS_REPLY",
      entity: booking ? "Booking" : "Inbound",
      entityId: booking?.id ?? null,
      details: { from, body, sid: params.MessageSid ?? null, code: booking?.confirmationCode ?? null },
    },
  }).catch((e) => console.error("[twilio/inbound] log failed:", (e as Error)?.message));

  // To the office: WhatsApp if it is set up, email if not.
  await notifyAdmin(
    `Customer text reply${booking ? ` — booking ${booking.confirmationCode}` : ""}\n` +
    `From: ${from}${booking?.guestName ? ` (${booking.guestName})` : ""}\n` +
    `"${body}"\n` +
    (booking ? `Pickup: ${booking.pickupAddress}` : "No booking is linked to this number."),
  ).catch(() => {});

  // Told once a day where a person is. A reply to every message would be a
  // second text cost per message and a loop if the other side is automatic too.
  const recent = await prisma.activityLog.findFirst({
    where: {
      action: "SMS_AUTOREPLY",
      createdAt: { gte: new Date(Date.now() - AUTO_REPLY_EVERY_MS) },
      details: { path: ["from"], equals: from },
    },
    select: { id: true },
  }).catch(() => null);
  if (recent) return twiml();

  await prisma.activityLog.create({
    data: { action: "SMS_AUTOREPLY", entity: "Inbound", entityId: booking?.id ?? null, details: { from } },
  }).catch(() => {});

  return twiml(
    `Elite BCN: thanks, we got your message and the office will read it. For anything urgent call, text or WhatsApp ${COMPANY.phone}. ` +
    `Gracias, hemos recibido tu mensaje. Urgente: ${COMPANY.phone}`,
  );
}
