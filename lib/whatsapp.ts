// WhatsApp Cloud API.
//
// Required env vars: WA_PHONE_ID, WA_TOKEN
// Optional:          WA_ADMIN_NUMBER, WA_TEMPLATE_LANGUAGE, and one
//                    WA_TEMPLATE_* per message (see lib/notifications/whatsapp-templates.ts)
//
// Two kinds of message, and the difference is the whole difficulty:
//
//   TEMPLATE  Pre-approved wording with {{1}} {{2}} slots. May be sent to
//             anyone, at any time. This is what a booking confirmation, a
//             reminder or a delay notice has to be, because the customer has
//             usually not messaged us in the last 24 hours.
//
//   TEXT      Free wording. Meta only accepts it inside the 24 hours after the
//             customer last wrote to us; outside that it is rejected.
//
// A reminder sent as TEXT therefore works for a customer who happened to
// message yesterday and silently does not for everybody else.

import { toE164 } from "@/lib/phone";

const WA_API_VERSION = "v21.0";

export type WhatsAppOutcome = "sent" | "skipped" | "failed";

export interface WhatsAppResult {
  outcome: WhatsAppOutcome;
  /** Meta's message id, when it accepted the message. */
  id?: string;
  /** Why it was skipped or failed. Safe to show to the office. */
  reason?: string;
}

/** True when there is enough configuration to send. */
export function whatsappConfigured(): boolean {
  return Boolean(process.env.WA_PHONE_ID && process.env.WA_TOKEN);
}

/** Meta's error envelope: { error: { code, message, error_data? } }. */
function parseError(raw: string): { code: number; message: string } {
  try {
    const e = (JSON.parse(raw) as { error?: { code?: number; message?: string; error_data?: { details?: string } } }).error;
    return {
      code: Number(e?.code ?? 0),
      message: e?.error_data?.details ?? e?.message ?? raw.slice(0, 200),
    };
  } catch {
    return { code: Number(raw.match(/"code"\s*:\s*(\d+)/)?.[1] ?? 0), message: raw.slice(0, 200) };
  }
}

/**
 * What a Meta error code means for us.
 *
 * Most of these are configuration, and the reason says which one, because
 * "WhatsApp API 400" tells the office nothing about what to fix.
 */
function classify(code: number, message: string): { outcome: WhatsAppOutcome; reason: string } {
  switch (code) {
    case 131026:
      return { outcome: "skipped", reason: "that number is not on WhatsApp" };
    case 131047:
      return { outcome: "skipped", reason: "outside the 24-hour window and no template was used" };
    case 190:
      return { outcome: "failed", reason: "the WhatsApp access token has expired or is invalid (WA_TOKEN)" };
    case 132001:
      return { outcome: "failed", reason: "the template does not exist, or is not approved yet, in the language sent" };
    case 132000:
      return { outcome: "failed", reason: "the template was sent with the wrong number of fields" };
    case 132012:
      return { outcome: "failed", reason: "a template field has the wrong format" };
    case 131030:
      return { outcome: "failed", reason: "WhatsApp is in test mode and this number is not on the allowed list" };
    case 131042:
      return { outcome: "failed", reason: "the WhatsApp Business account has a payment problem" };
    default:
      return { outcome: "failed", reason: `WhatsApp error ${code || "unknown"}: ${message}` };
  }
}

async function post(payload: Record<string, unknown>): Promise<WhatsAppResult> {
  const phoneId = process.env.WA_PHONE_ID;
  const token = process.env.WA_TOKEN;
  if (!phoneId || !token) return { outcome: "skipped", reason: "WhatsApp is not configured" };

  try {
    const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[] };
      return { outcome: "sent", id: data.messages?.[0]?.id };
    }

    const { code, message } = parseError(await res.text().catch(() => ""));
    return classify(code, message);
  } catch (e) {
    return { outcome: "failed", reason: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Meta rejects a template field that is empty, has a newline or tab in it, or
 * has four spaces in a row, with an error that does not say which field. A
 * booking route or an address can contain any of those, so each one is made
 * safe here, and an empty one becomes a dash rather than failing the message.
 */
export function templateField(value: unknown): string {
  const s = String(value ?? "")
    .replace(/[\r\n\t]+/g, ", ")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, 1000);
  return s || "-";
}

/**
 * A pre-approved template, to anyone, at any time.
 *
 * Never throws: it returns what happened, and the caller decides how loudly to
 * say so.
 */
export async function sendWhatsAppTemplate(
  phone: string | null | undefined,
  template: string,
  fields: unknown[],
  language = process.env.WA_TEMPLATE_LANGUAGE || "en",
): Promise<WhatsAppResult> {
  if (!whatsappConfigured()) return { outcome: "skipped", reason: "WhatsApp is not configured" };

  const to = toE164(phone);
  if (!to) return { outcome: "skipped", reason: phone ? "number has no country code" : "no phone number" };

  return post({
    to,
    type: "template",
    template: {
      name: template,
      language: { code: language },
      components: fields.length
        ? [{ type: "body", parameters: fields.map((f) => ({ type: "text", text: templateField(f) })) }]
        : [],
    },
  });
}

/**
 * The booking confirmation, sent after a payment clears.
 *
 * Kept for its existing callers. Template name "booking_confirmation" must be
 * approved in Meta Business Manager with three fields, in this order:
 * reference, pickup time, route.
 */
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
}): Promise<WhatsAppResult> {
  const name = process.env.WA_TEMPLATE_BOOKING_CONFIRMED || "booking_confirmation";
  const result = await sendWhatsAppTemplate(phone, name, [bookingRef, pickupDatetime, route]);
  if (result.outcome === "sent") console.log("[whatsapp] sent", result.id, "to", toE164(phone));
  else if (result.outcome === "failed") throw new Error(`WhatsApp: ${result.reason}`);
  return result;
}

/**
 * Free text to a customer, used by the shared notification service.
 *
 * Only accepted inside the 24-hour window after the customer's last inbound
 * message. Outside it Meta rejects the send, which is an expected outcome and
 * not a fault, so it returns false rather than throwing. Genuine failures (a
 * bad token, a malformed request) still throw so they surface.
 *
 * Returns true when WhatsApp accepted the message.
 */
export async function sendWhatsAppText(phone: string, text: string): Promise<boolean> {
  if (!whatsappConfigured()) return false;
  const to = toE164(phone);
  if (!to) return false;

  const result = await post({ to, type: "text", text: { body: text.slice(0, 4096) } });
  if (result.outcome === "sent") return true;
  if (result.outcome === "skipped") return false;
  throw new Error(`WhatsApp: ${result.reason}`);
}

/**
 * Free text from the office to a customer, reporting what happened instead of
 * throwing. The inbox needs the message id Meta gives back (to match delivery
 * receipts to it) and the reason when it is refused, which sendWhatsAppText
 * folds into a boolean.
 */
export async function sendWhatsAppTextResult(phone: string | null | undefined, text: string): Promise<WhatsAppResult> {
  if (!whatsappConfigured()) return { outcome: "skipped", reason: "WhatsApp is not configured" };
  const to = toE164(phone);
  if (!to) return { outcome: "skipped", reason: phone ? "number has no country code" : "no phone number" };
  return post({ to, type: "text", text: { body: text.slice(0, 4096), preview_url: true } });
}

/**
 * A photo, document or voice note a customer sent.
 *
 * Meta hands out a media id, not a file. Fetching it is two calls (the id gives
 * a short-lived address, the address gives the bytes) and both need the access
 * token, which is why the browser cannot do it and the admin goes through the
 * server. Returns null when it cannot be had.
 */
export async function fetchWhatsAppMedia(mediaId: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const token = process.env.WA_TOKEN;
  if (!token || !/^\d{5,30}$/.test(mediaId)) return null;
  try {
    const meta = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!meta.ok) return null;
    const { url, mime_type } = (await meta.json()) as { url?: string; mime_type?: string };
    if (!url) return null;
    const file = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!file.ok) return null;
    return { bytes: await file.arrayBuffer(), contentType: mime_type ?? file.headers.get("content-type") ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

/**
 * The office's own number, as configured.
 *
 * Customer numbers are held to the strict rule that a number without its
 * country is not a number. This one is different: the owner writes it in the
 * same form as a wa.me link, "34635383712", which is international by
 * definition and has no plus. Treating that as ambiguous would have switched
 * the office's own alerts from WhatsApp back to email the moment WhatsApp was
 * configured, with nothing to say why.
 */
export function ownerNumber(raw: string | null | undefined): string | null {
  const strict = toE164(raw);
  if (strict) return strict;
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? toE164(`+${digits}`) : null;
}

/**
 * Fire-and-forget operational alert to the office.
 *
 * WhatsApp where it is configured, email where it is not.
 *
 * The fallback is the point of this function. WhatsApp has never been
 * configured on this deployment — WA_PHONE_ID and WA_TOKEN are unset — so the
 * old version returned at its first line and dropped every alert it was handed.
 * Flight delays, new leads and cancellations were all detected correctly and
 * then went nowhere, which reads from the outside exactly like a feature that
 * was never built.
 *
 * The subject is taken as the first line of the text, which is how every caller
 * already writes these messages.
 *
 * Imported lazily because lib/resend.ts imports this module; a top-level import
 * either way round would be a cycle.
 */
export async function notifyAdmin(
  text: string,
  opts: {
    /**
     * Fall back to email when WhatsApp is unconfigured. Default true.
     *
     * Callers that already send the office their own email must pass false, or
     * the same event arrives twice. That is exactly what happened when the
     * fallback was introduced: the new-lead alert sends its own email and then
     * called this, so one unpaid enquiry produced two identical messages.
     */
    emailFallback?: boolean;
  } = {},
): Promise<void> {
  // `||`, not `??`: a variable that exists but is empty is how an unset value
  // usually shows up in a hosting dashboard, and `??` would have let it hide the
  // number below it.
  const to = ownerNumber(process.env.WA_ADMIN_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);

  /** Email is the way an alert is certain to arrive. */
  const byEmail = async () => {
    if (opts.emailFallback === false) return;
    try {
      const { sendAdminAlertEmail } = await import("@/lib/resend");
      const [first, ...rest] = text.split("\n");
      await sendAdminAlertEmail(first.trim() || "Operations alert", rest.join("\n").trim() || text);
    } catch (e) {
      console.warn("[alerts] admin email fallback failed:", (e as Error)?.message);
    }
  };

  if (!whatsappConfigured() || !to) return byEmail();

  const result = await post({ to, type: "text", text: { body: text } });
  if (result.outcome !== "sent") {
    // WhatsApp refuses free text to anyone who has not written to the business
    // in the last 24 hours, and the owner usually has not. Before WhatsApp was
    // switched on this function sent an email; once it is on, that refusal
    // would have meant a flight delay or a new lead reaching no one. So a
    // refusal falls back to the email, exactly as "not configured" does.
    console.warn("[whatsapp] admin notify:", result.reason);
    return byEmail();
  }
}

/**
 * Former name, kept so the existing call sites keep working.
 *
 * The name is now inaccurate — it is no longer WhatsApp-only — but renaming it
 * across a dozen call sites would be churn for no behavioural change. New code
 * should call notifyAdmin.
 */
export const notifyAdminWhatsApp = notifyAdmin;
