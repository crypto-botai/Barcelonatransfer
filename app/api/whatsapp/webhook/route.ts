import { NextRequest, NextResponse } from "next/server";
import { parseWebhook, validMetaSignature } from "@/lib/whatsapp-inbox";
import { recordInbound, recordStatus } from "@/lib/whatsapp-inbox-store";
import { notifyAdmin } from "@/lib/whatsapp";
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
 */

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const token = process.env.WA_VERIFY_TOKEN;
  if (token && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === token) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  // The signature covers the raw body, so it is read as text, before any parsing.
  const raw = await req.text();
  if (!validMetaSignature(raw, req.headers.get("x-hub-signature-256"), process.env.WA_APP_SECRET)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new NextResponse(null, { status: 200 }); }

  const { messages, statuses } = parseWebhook(payload);

  try {
    for (const m of messages) {
      const isNew = await recordInbound(m);
      // The office is told about each new message, once. WhatsApp to the owner
      // only works inside a 24-hour window, so notifyAdmin falls back to email.
      if (isNew) {
        await notifyAdmin(
          `WhatsApp message${m.name ? ` from ${m.name}` : ""} (${m.phone})\n` +
          `"${m.text.slice(0, 500)}"\n` +
          `Reply: ${BASE_URL}/admin/whatsapp?phone=${encodeURIComponent(m.phone)}`,
        ).catch(() => {});
      }
    }
    for (const s of statuses) await recordStatus(s);
  } catch (e) {
    console.error("[whatsapp/webhook] store failed:", (e as Error)?.message);
    return new NextResponse("Store failed", { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
