import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { smsConfigured } from "@/lib/sms";
import { whatsappConfigured } from "@/lib/whatsapp";
import { WHATSAPP_TEMPLATES, whatsappTemplateFor } from "@/lib/notifications/whatsapp-templates";
import type { NotificationEvent } from "@/lib/notifications/events";

/**
 * What is switched on for messaging customers' phones.
 *
 * Booleans and template names only. Never a token, a SID or a number: this is
 * read by the admin screen to explain why a button is greyed out, and the
 * answer to "why did nothing send" should not be a place secrets can leak from.
 */
export async function GET() {
  const s = await getServerSession(authOptions);
  const u = s?.user as { role?: string } | undefined;
  if (!s || u?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = Object.keys(WHATSAPP_TEMPLATES) as NotificationEvent[];

  return NextResponse.json({
    sms: {
      configured: smsConfigured(),
      // Whether a Messaging Service or a fixed sender is doing the choosing.
      via: process.env.TWILIO_MESSAGING_SERVICE_SID ? "messaging-service" : process.env.TWILIO_FROM ? "sender" : null,
    },
    whatsapp: {
      configured: whatsappConfigured(),
      // Which messages go as an approved template (reach anyone) and which fall
      // back to free text (reach only customers who wrote to us in the last day).
      templates: events.map((event) => {
        const t = whatsappTemplateFor(event);
        return { event, template: t?.name ?? null };
      }),
    },
  });
}
