/**
 * SMS to a customer's phone, through Twilio.
 *
 * Required env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and one of
 *   TWILIO_FROM                  the sender: an alphanumeric name ("EliteBCN")
 *                                or a number in E.164 form
 *   TWILIO_MESSAGING_SERVICE_SID a Messaging Service, if one is set up (it
 *                                chooses the right sender per country)
 *
 * Calls Twilio's REST API directly rather than through their SDK. It is one
 * POST, and the SDK would add a dependency to every serverless function for
 * the sake of it.
 *
 * Nothing in here throws. A text failing must never roll back a paid booking,
 * so every outcome comes back as a value: sent, skipped (nothing was wrong,
 * there was just nothing to do) or failed (something was). The distinction is
 * what tells "SMS is off" apart from "SMS is on and broken".
 */

import { toE164 } from "@/lib/phone";
import { BASE_URL } from "@/lib/seo";

export type SmsOutcome = "sent" | "skipped" | "failed";

export interface SmsResult {
  outcome: SmsOutcome;
  /** Twilio's message id, when it accepted the text. */
  id?: string;
  /** Why it was skipped or failed. Safe to show to the office. */
  reason?: string;
}

/** True when there is enough configuration to send. */
export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID),
  );
}

/**
 * Text that fits in a single-byte SMS.
 *
 * A message is 160 characters in the GSM-7 alphabet and only 70 the moment a
 * single character falls outside it, at which point the carrier switches the
 * whole message to UCS-2 and bills it as several segments. The copy this site
 * writes is full of exactly those characters: the em dash in "Pickup {{when}} —
 * {{route}}", the arrow in a route, the curly apostrophe, and Spanish accents
 * like á and ó. One of them quietly more than doubles what a text costs.
 *
 * So the text is made safe before it goes. Accents are folded to the plain
 * letter where GSM-7 has no form of it (é, ñ, ü and a few others it does have,
 * and those are left alone), dashes and quotes become their ASCII equivalents,
 * and arrows become "to".
 */
const FOLD: Array<[RegExp, string]> = [
  [/[—–−]/g, "-"],        // em dash, en dash, minus
  [/[‘’‛′]/g, "'"],  // curly single quotes, prime
  [/[“”„″]/g, '"'],  // curly double quotes
  [/…/g, "..."],                    // ellipsis
  [/\s*[→⇒⟶]\s*/g, " to "], // arrows
  [/ /g, " "],                      // non-breaking space
  [/[áâãåā]/g, "a"], [/[ÁÂÃÅĀ]/g, "A"],
  [/[íîï]/g, "i"],   [/[ÍÎÏ]/g, "I"],
  [/[óôõ]/g, "o"],   [/[ÓÔÕ]/g, "O"],
  [/[úû]/g, "u"],    [/[ÚÛ]/g, "U"],
  [/[ç]/g, "c"],     [/[Ç]/g, "C"],
  [/[œ]/g, "oe"],    [/[Œ]/g, "OE"],
  [/[ý]/g, "y"],     [/[Ý]/g, "Y"],
];

/** The GSM 03.38 basic set, plus the extension set which costs two each. */
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€";

export function toGsmSafe(text: string): string {
  let out = text;
  for (const [re, to] of FOLD) out = out.replace(re, to);
  // Whatever is still outside both sets cannot be sent in one byte. Dropping it
  // is better than letting it push the message into UCS-2.
  return [...out]
    .filter((ch) => GSM_BASIC.includes(ch) || GSM_EXTENDED.includes(ch))
    .join("");
}

/** How many segments a GSM-safe text will be billed as. */
export function smsSegments(text: string): number {
  const units = [...text].reduce((n, ch) => n + (GSM_EXTENDED.includes(ch) ? 2 : 1), 0);
  if (units === 0) return 0;
  return units <= 160 ? 1 : Math.ceil(units / 153);
}

/**
 * Twilio error codes that mean "this number cannot be texted", not "this
 * integration is broken". They are the customer's situation, and reporting
 * them as failures would bury real faults in noise.
 */
const NOT_DELIVERABLE: Record<number, string> = {
  21211: "not a valid phone number",
  21214: "not a mobile number that can receive texts",
  21217: "number does not exist",
  21408: "texts to this country are not enabled on the Twilio account",
  21610: "the customer replied STOP and has opted out",
  21614: "not a mobile number that can receive texts",
};

/** Longest text sent in one go: a handful of segments, never an essay. */
const MAX_CHARS = 480;

export async function sendSms(
  phone: string | null | undefined,
  text: string,
  opts: {
    /**
     * The booking this text is about. When given, Twilio is asked to report
     * back whether the text arrived, to /api/twilio/status, and the report is
     * filed against this booking so the office can see it.
     */
    bookingId?: string | null;
  } = {},
): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!sid || !token || (!from && !service)) {
    return { outcome: "skipped", reason: "SMS is not configured" };
  }

  const to = toE164(phone);
  if (!to) {
    return { outcome: "skipped", reason: phone ? "number has no country code" : "no phone number" };
  }

  const body = toGsmSafe(text).trim().slice(0, MAX_CHARS);
  if (!body) return { outcome: "skipped", reason: "nothing to send" };

  const form = new URLSearchParams({ To: to, Body: body });
  // A Messaging Service picks the sender per destination, so it wins when both
  // are set.
  if (service) form.set("MessagingServiceSid", service);
  else form.set("From", from as string);
  // The delivery receipt. Without it "sent" only means Twilio accepted the
  // text, which is true of a message to a switched-off phone as well.
  if (opts.bookingId) {
    form.set("StatusCallback", `${BASE_URL}/api/twilio/status?booking=${encodeURIComponent(opts.bookingId)}`);
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );

    const data = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string };

    if (res.ok && data.sid) return { outcome: "sent", id: data.sid };

    const why = data.code ? NOT_DELIVERABLE[data.code] : undefined;
    if (why) return { outcome: "skipped", reason: why };

    return {
      outcome: "failed",
      reason: `Twilio ${res.status}${data.code ? ` (${data.code})` : ""}: ${data.message ?? "no detail"}`,
    };
  } catch (e) {
    return { outcome: "failed", reason: e instanceof Error ? e.message : String(e) };
  }
}
