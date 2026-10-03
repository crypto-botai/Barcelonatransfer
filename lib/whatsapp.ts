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
import { MAX_MEDIA_BYTES, SENDABLE_MEDIA } from "@/lib/whatsapp-files";

export { MAX_MEDIA_BYTES, SENDABLE_MEDIA };

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
export async function sendWhatsAppTextResult(
  phone: string | null | undefined,
  text: string,
  opts: { replyTo?: string | null } = {},
): Promise<WhatsAppResult> {
  const to = recipient(phone);
  if (typeof to !== "string") return to;
  return post({
    to,
    type: "text",
    text: { body: text.slice(0, 4096), preview_url: true },
    ...(opts.replyTo ? { context: { message_id: opts.replyTo } } : {}),
  });
}

/** The number to send to, or the reason there is none. Shared by every free-form send below. */
function recipient(phone: string | null | undefined): string | WhatsAppResult {
  if (!whatsappConfigured()) return { outcome: "skipped", reason: "WhatsApp is not configured" };
  const to = toE164(phone);
  if (!to) return { outcome: "skipped", reason: phone ? "number has no country code" : "no phone number" };
  return to;
}

/**
 * Tell the customer their messages were read: the blue ticks on their side.
 *
 * Naming the newest message marks everything before it too. Best effort — a
 * failure here must never get in the way of the office reading the chat.
 */
export async function markWhatsAppRead(wamid: string): Promise<void> {
  if (!whatsappConfigured() || !wamid) return;
  await post({ status: "read", message_id: wamid }).catch(() => {});
}

/** React to one of the customer's messages. An empty emoji removes the reaction. */
export async function sendWhatsAppReaction(phone: string, wamid: string, emoji: string): Promise<WhatsAppResult> {
  const to = recipient(phone);
  if (typeof to !== "string") return to;
  return post({ to, type: "reaction", reaction: { message_id: wamid, emoji } });
}

/** Upload a file to WhatsApp and get the id a message can then refer to. */
export async function uploadWhatsAppMedia(
  bytes: ArrayBuffer,
  mime: string,
  filename: string,
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const phoneId = process.env.WA_PHONE_ID;
  const token = process.env.WA_TOKEN;
  if (!phoneId || !token) return { ok: false, reason: "WhatsApp is not configured" };
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mime);
    form.append("file", new Blob([bytes], { type: mime }), filename);
    const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const e = parseError(await res.text().catch(() => ""));
      return { ok: false, reason: classify(e.code, e.message).reason };
    }
    const { id } = (await res.json()) as { id?: string };
    return id ? { ok: true, id } : { ok: false, reason: "WhatsApp did not return a file id" };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** A photo or document, from an id returned by uploadWhatsAppMedia. */
export async function sendWhatsAppMedia(
  phone: string,
  m: { kind: "image" | "document"; mediaId: string; caption?: string; filename?: string; replyTo?: string | null },
): Promise<WhatsAppResult> {
  const to = recipient(phone);
  if (typeof to !== "string") return to;
  const body =
    m.kind === "image"
      ? { id: m.mediaId, ...(m.caption ? { caption: m.caption.slice(0, 1024) } : {}) }
      : { id: m.mediaId, ...(m.filename ? { filename: m.filename.slice(0, 240) } : {}), ...(m.caption ? { caption: m.caption.slice(0, 1024) } : {}) };
  return post({ to, type: m.kind, [m.kind]: body, ...(m.replyTo ? { context: { message_id: m.replyTo } } : {}) });
}

/** A list menu or a tap-to-open link button. Free-form, so it needs the 24-hour window like text does. */
export async function sendWhatsAppInteractive(
  phone: string,
  interactive: Record<string, unknown>,
  opts: { replyTo?: string | null } = {},
): Promise<WhatsAppResult> {
  const to = recipient(phone);
  if (typeof to !== "string") return to;
  return post({ to, type: "interactive", interactive, ...(opts.replyTo ? { context: { message_id: opts.replyTo } } : {}) });
}

// ─── The business profile: photo, about, address, hours of the page customers see ──

/** The Meta app that owns the number. Not a secret: it appears in every Meta dashboard URL. */
export const WA_APP_ID = process.env.WA_APP_ID || "2233351653890022";

/** The WhatsApp Business Account that owns the number. Also an identifier, not a secret. */
export const WA_WABA_ID = process.env.WA_WABA_ID || "2114337302504279";

export interface WhatsAppProfile {
  about: string;
  address: string;
  description: string;
  email: string;
  vertical: string;
  websites: string[];
  profile_picture_url: string | null;
}

export async function getWhatsAppProfile(): Promise<{ ok: true; profile: WhatsAppProfile } | { ok: false; reason: string }> {
  const phoneId = process.env.WA_PHONE_ID;
  const token = process.env.WA_TOKEN;
  if (!phoneId || !token) return { ok: false, reason: "WhatsApp is not configured" };
  try {
    const res = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!res.ok) {
      const e = parseError(await res.text().catch(() => ""));
      return { ok: false, reason: classify(e.code, e.message).reason };
    }
    const d = ((await res.json()) as { data?: Partial<WhatsAppProfile>[] }).data?.[0] ?? {};
    return {
      ok: true,
      profile: {
        about: d.about ?? "", address: d.address ?? "", description: d.description ?? "", email: d.email ?? "",
        vertical: d.vertical ?? "", websites: d.websites ?? [], profile_picture_url: d.profile_picture_url ?? null,
      },
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateWhatsAppProfile(
  fields: Partial<Omit<WhatsAppProfile, "profile_picture_url">> & { profile_picture_handle?: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const phoneId = process.env.WA_PHONE_ID;
  const token = process.env.WA_TOKEN;
  if (!phoneId || !token) return { ok: false, reason: "WhatsApp is not configured" };
  try {
    const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/whatsapp_business_profile`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...fields }),
    });
    if (res.ok) return { ok: true };
    const e = parseError(await res.text().catch(() => ""));
    return { ok: false, reason: classify(e.code, e.message).reason };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Change the profile photo.
 *
 * Meta wants it in two steps: the picture is uploaded to the app, which returns
 * a handle, and the handle is then set on the profile. The picture must be a
 * JPEG or PNG, square works best, and at most 5 MB.
 */
export async function setWhatsAppProfilePhoto(bytes: ArrayBuffer, mime: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const token = process.env.WA_TOKEN;
  if (!token || !process.env.WA_PHONE_ID) return { ok: false, reason: "WhatsApp is not configured" };
  if (mime !== "image/jpeg" && mime !== "image/png") return { ok: false, reason: "The profile photo must be a JPEG or PNG" };
  try {
    const session = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${WA_APP_ID}/uploads?file_length=${bytes.byteLength}&file_type=${encodeURIComponent(mime)}&file_name=profile`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
    if (!session.ok) {
      const e = parseError(await session.text().catch(() => ""));
      return { ok: false, reason: `Could not start the upload: ${e.message}` };
    }
    const { id } = (await session.json()) as { id?: string };
    if (!id) return { ok: false, reason: "Meta did not open an upload session" };

    const up = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${id}`, {
      method: "POST",
      headers: { Authorization: `OAuth ${token}`, file_offset: "0", "Content-Type": mime },
      body: bytes,
    });
    if (!up.ok) {
      const e = parseError(await up.text().catch(() => ""));
      return { ok: false, reason: `Could not upload the photo: ${e.message}` };
    }
    const { h } = (await up.json()) as { h?: string };
    if (!h) return { ok: false, reason: "Meta did not return a photo handle" };

    return updateWhatsAppProfile({ profile_picture_handle: h });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
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

// ─── Is Meta actually delivering customers' messages to this app? ──────────────

export type WhatsAppConnection =
  | { ok: true; subscribed: boolean; apps: { id: string; name: string }[] }
  | { ok: false; reason: string };

/**
 * Which apps the business account sends its messages to.
 *
 * Saving a webhook address in the app is not enough on its own. Meta's sample
 * message from the dashboard goes to the app directly, so it arrives even when
 * the business account is not connected, while a customer's real message does
 * not. Real messages are only passed on to apps the account is subscribed to,
 * and this is the one place that says whether ours is.
 */
export async function getWhatsAppConnection(): Promise<WhatsAppConnection> {
  const token = process.env.WA_TOKEN;
  if (!token) return { ok: false, reason: "WhatsApp is not configured" };
  try {
    const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${WA_WABA_ID}/subscribed_apps`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!res.ok) {
      const e = parseError(await res.text().catch(() => ""));
      return { ok: false, reason: classify(e.code, e.message).reason };
    }
    const data = ((await res.json()) as { data?: { whatsapp_business_api_data?: { id?: string; name?: string } }[] }).data ?? [];
    const apps = data.map((d) => ({ id: String(d.whatsapp_business_api_data?.id ?? ""), name: String(d.whatsapp_business_api_data?.name ?? "") })).filter((a) => a.id);
    return { ok: true, subscribed: apps.some((a) => a.id === WA_APP_ID), apps };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Subscribe the business account to our app, so customers' messages are delivered to the webhook. */
export async function subscribeWhatsAppApp(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const token = process.env.WA_TOKEN;
  if (!token) return { ok: false, reason: "WhatsApp is not configured" };
  try {
    const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${WA_WABA_ID}/subscribed_apps`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return { ok: true };
    const e = parseError(await res.text().catch(() => ""));
    return { ok: false, reason: classify(e.code, e.message).reason };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Catalogue on the number ──────────────────────────────────────────────────

export interface WhatsAppCatalogState {
  /** The shop icon shows in the chat header and the business profile. */
  visible: boolean;
  /** Customers can add products to a cart. We take bookings on the site, so this stays off. */
  cartEnabled: boolean;
}

/**
 * Whether the catalogue is switched on for the number. Connecting a catalogue
 * to the business account is not enough: the number has its own switch, and
 * until it is on, customers see no shop icon.
 */
export async function getWhatsAppCatalog(): Promise<{ ok: true; state: WhatsAppCatalogState } | { ok: false; reason: string }> {
  const phoneId = process.env.WA_PHONE_ID;
  const token = process.env.WA_TOKEN;
  if (!phoneId || !token) return { ok: false, reason: "WhatsApp is not configured" };
  try {
    const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/whatsapp_commerce_settings`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!res.ok) {
      const e = parseError(await res.text().catch(() => ""));
      return { ok: false, reason: classify(e.code, e.message).reason };
    }
    const d = ((await res.json()) as { data?: { is_catalog_visible?: boolean; is_cart_enabled?: boolean }[] }).data?.[0] ?? {};
    return { ok: true, state: { visible: d.is_catalog_visible === true, cartEnabled: d.is_cart_enabled === true } };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Show or hide the catalogue on the number. The cart is always left off. */
export async function setWhatsAppCatalog(visible: boolean): Promise<{ ok: true } | { ok: false; reason: string }> {
  const phoneId = process.env.WA_PHONE_ID;
  const token = process.env.WA_TOKEN;
  if (!phoneId || !token) return { ok: false, reason: "WhatsApp is not configured" };
  try {
    const res = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/whatsapp_commerce_settings?is_catalog_visible=${visible}&is_cart_enabled=false`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) return { ok: true };
    const e = parseError(await res.text().catch(() => ""));
    return { ok: false, reason: classify(e.code, e.message).reason };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Message templates in Meta ────────────────────────────────────────────────

export interface MetaTemplate {
  name: string;
  status: string; // APPROVED | PENDING | REJECTED | PAUSED | DISABLED …
  category: string;
  language: string;
  rejectedReason: string | null;
}

/** Every template on the business account, with where its approval stands. */
export async function listWhatsAppTemplates(): Promise<{ ok: true; templates: MetaTemplate[] } | { ok: false; reason: string }> {
  const token = process.env.WA_TOKEN;
  if (!token) return { ok: false, reason: "WhatsApp is not configured" };
  try {
    const res = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${WA_WABA_ID}/message_templates?fields=name,status,category,language,rejected_reason&limit=200`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!res.ok) {
      const e = parseError(await res.text().catch(() => ""));
      return { ok: false, reason: classify(e.code, e.message).reason };
    }
    const data = ((await res.json()) as { data?: { name: string; status: string; category: string; language: string; rejected_reason?: string }[] }).data ?? [];
    return {
      ok: true,
      templates: data.map((t) => ({
        name: t.name, status: t.status, category: t.category, language: t.language,
        rejectedReason: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null,
      })),
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Submit one template for Meta's review. It is usually decided within minutes. */
export async function createWhatsAppTemplate(def: {
  name: string; language: string; category: string; body: string; examples: readonly string[];
}): Promise<{ ok: true; status: string } | { ok: false; reason: string }> {
  const token = process.env.WA_TOKEN;
  if (!token) return { ok: false, reason: "WhatsApp is not configured" };
  try {
    const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${WA_WABA_ID}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: def.name,
        language: def.language,
        category: def.category,
        components: [{ type: "BODY", text: def.body, ...(def.examples.length ? { example: { body_text: [def.examples] } } : {}) }],
      }),
    });
    if (!res.ok) {
      const e = parseError(await res.text().catch(() => ""));
      return { ok: false, reason: e.message || classify(e.code, e.message).reason };
    }
    const { status } = (await res.json().catch(() => ({}))) as { status?: string };
    return { ok: true, status: status ?? "PENDING" };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
