import { NextRequest, NextResponse } from "next/server";
import { parseWebhook, validMetaSignature, type InboundMessage } from "@/lib/whatsapp-inbox";
import { recordInbound, recordOutbound, recordReaction, recordStatus, lastOutboundTimes } from "@/lib/whatsapp-inbox-store";
import { notifyAdmin, sendWhatsAppInteractive, sendWhatsAppTextResult } from "@/lib/whatsapp";
import { pushNewMessageToAdmins } from "@/lib/whatsapp-alerts";
import { loadSettings } from "@/lib/whatsapp-settings-store";
import { pickAutoReply } from "@/lib/whatsapp-settings";
import { buildServiceLink, parseServiceChoice, resolveServices } from "@/lib/whatsapp-services";
import { BASE_URL } from "@/lib/seo";

/**
 * Where Meta delivers WhatsApp messages and delivery updates.
 *
 * Public by necessity, so it believes nothing it cannot verify:
 *   GET   Meta's one-off handshake when the webhook is saved. It must echo
 *         the challenge, and only when the verify token matches ours.
 *   POST  Every message and status. It must carry Meta's signature over the
 *         exact bytes sent, made with the app secret.
 *
 * It answers 200 once a request is verified and stored, and 500 if storing
 * failed, because Meta retries a failure and gives up on an endpoint that keeps
 * answering errors. Retried messages are harmless: each is stored once.
 *
 * Everything that happens because a message arrived (alerts, a menu choice, an
 * automatic reply) comes after it is stored and can fail without affecting it.
 */

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const token = process.env.WA_VERIFY_TOKEN;
  if (token && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === token) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** What the office hears, and what the customer is sent back, for one new message. */
async function react(m: InboundMessage): Promise<void> {
  const settings = await loadSettings();

  // The office, on every channel it has chosen. Desktop first: it is the one that is looked at.
  await Promise.allSettled([
    pushNewMessageToAdmins(m),
    settings.emailAlerts
      ? notifyAdmin(
          `WhatsApp message${m.name ? ` from ${m.name}` : ""} (${m.phone})\n` +
            `"${m.text.slice(0, 500)}"\n` +
            `Reply: ${BASE_URL}/admin/whatsapp?phone=${encodeURIComponent(m.phone)}`,
        )
      : Promise.resolve(),
  ]);

  // The customer picked a row from our services menu: answer with the picture, the price and a Book button.
  const picked = parseServiceChoice(m.choiceId);
  if (picked) {
    const [service] = await resolveServices(settings.services.filter((s) => s.id === picked));
    if (service) {
      const link = buildServiceLink(service);
      const sent = await sendWhatsAppInteractive(m.phone, link, { replyTo: m.wamid });
      if (sent.outcome === "sent" && sent.id) {
        await recordOutbound({
          phone: m.phone, wamid: sent.id, by: "Services menu", type: "text",
          text: `${service.title}: ${service.fromPrice ? `from €${service.fromPrice}` : "price on booking"}. Book: ${service.url}`,
          replyTo: m.wamid,
        });
      }
      return;
    }
  }

  // An automatic reply, if the office has switched one on and one is due.
  const due = pickAutoReply({ settings, now: new Date(), ...(await lastOutboundTimes(m.phone)) });
  if (due) {
    const sent = await sendWhatsAppTextResult(m.phone, due.text);
    if (sent.outcome === "sent" && sent.id) {
      await recordOutbound({ phone: m.phone, wamid: sent.id, text: due.text, by: "Auto-reply" });
    }
  }
}

export async function POST(req: NextRequest) {
  // The signature covers the raw body, so it is read as text, before any parsing.
  const raw = await req.text();
  if (!validMetaSignature(raw, req.headers.get("x-hub-signature-256"), process.env.WA_APP_SECRET)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new NextResponse(null, { status: 200 }); }

  const { messages, statuses, reactions } = parseWebhook(payload);

  const fresh: InboundMessage[] = [];
  try {
    for (const m of messages) {
      if (await recordInbound(m)) fresh.push(m);
    }
    for (const s of statuses) await recordStatus(s);
    for (const r of reactions) await recordReaction(r);
  } catch (e) {
    console.error("[whatsapp/webhook] store failed:", (e as Error)?.message);
    return new NextResponse("Store failed", { status: 500 });
  }

  // Stored. Everything below is a courtesy and must not turn a stored message into a retry.
  for (const m of fresh) {
    await react(m).catch((e) => console.warn("[whatsapp/webhook] follow-up failed:", (e as Error)?.message));
  }

  return new NextResponse(null, { status: 200 });
}
