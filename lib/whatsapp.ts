// WhatsApp Cloud API — sends template messages after successful payment
// Required env vars: WA_PHONE_ID, WA_TOKEN
// Template name: "booking_confirmation" must be approved in Meta Business Manager

const WA_API_VERSION = "v21.0";

function toE164(phone: string): string {
  // Strip everything except digits, then re-add leading +
  const digits = phone.replace(/\D/g, "");
  // If it starts with 00, replace with +
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  // If already starts with country code (≥10 digits and no leading 0), keep as-is
  if (digits.length >= 10 && !digits.startsWith("0")) return "+" + digits;
  // Spanish number starting with 0 → +34
  if (digits.startsWith("0") && digits.length === 9) return "+34" + digits.slice(1);
  return "+" + digits;
}

export async function sendWhatsAppBookingConfirmation({
  phone,
  bookingRef,
  pickupDatetime,
  route,
}: {
  phone: string;
  bookingRef: string;
  pickupDatetime: string;
  route: string;
}): Promise<void> {
  const phoneId = process.env.WA_PHONE_ID;
  const token   = process.env.WA_TOKEN;

  if (!phoneId || !token) {
    console.warn("[whatsapp] WA_PHONE_ID or WA_TOKEN not set — skipping");
    return;
  }

  const e164 = toE164(phone);

  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to: e164,
    type: "template",
    template: {
      name: "booking_confirmation",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: bookingRef },
            { type: "text", text: pickupDatetime },
            { type: "text", text: route },
          ],
        },
      ],
    },
  });

  const res = await fetch(
    `https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${err}`);
  }

  const data = await res.json() as { messages?: { id: string }[] };
  console.log("[whatsapp] sent", data.messages?.[0]?.id, "to", e164);
}

/**
 * Freeform text message to a customer, used by the shared notification service.
 *
 * The WhatsApp Cloud API only allows freeform messages inside the 24-hour
 * window after the customer's last inbound message. Outside it, Meta rejects
 * the send with error 131047 / 131026. That is an expected, non-exceptional
 * outcome — it means "this customer has not messaged us recently", not "the
 * integration is broken" — so it returns false instead of throwing. Genuine
 * failures (bad token, malformed request) still throw so they surface.
 *
 * Returns true when WhatsApp accepted the message.
 */
export async function sendWhatsAppText(phone: string, text: string): Promise<boolean> {
  const phoneId = process.env.WA_PHONE_ID;
  const token   = process.env.WA_TOKEN;
  if (!phoneId || !token) return false;

  const res = await fetch(
    `https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/messages`,
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164(phone),
        type: "text",
        text: { body: text.slice(0, 4096) },
      }),
    },
  );

  if (res.ok) return true;

  const raw = await res.text().catch(() => "");
  const code = Number(raw.match(/"code"\s*:\s*(\d+)/)?.[1] ?? 0);
  // 131047 / 131026: re-engagement required, i.e. session window closed.
  if (code === 131047 || code === 131026) return false;

  throw new Error(`WhatsApp API ${res.status}: ${raw}`);
}

/**
 * Fire-and-forget admin booking alert via WhatsApp text message.
 * Uses the WA Cloud API freeform endpoint (works within 24 h session window).
 * Silently no-ops when WA_PHONE_ID / WA_TOKEN are not configured.
 */
export async function notifyAdminWhatsApp(text: string): Promise<void> {
  const phoneId = process.env.WA_PHONE_ID;
  const token   = process.env.WA_TOKEN;
  const adminWA = process.env.WA_ADMIN_NUMBER ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  if (!phoneId || !token || !adminWA) return;

  const to = toE164(adminWA);
  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });

  await fetch(
    `https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/messages`,
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body,
    }
  ).catch((e) => console.warn("[whatsapp] admin notify failed:", e?.message));
}
