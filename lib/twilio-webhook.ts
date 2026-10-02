/**
 * What Twilio calls on this site, and how to know it was Twilio.
 *
 * Two webhooks exist: a delivery receipt for every text we send, and a reply
 * from a customer. Both are public URLs, because Twilio has no login. Anyone
 * who finds them could post a made-up "delivered" or a fake customer message,
 * so every request is checked against Twilio's signature before it is believed.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { BASE_URL } from "@/lib/seo";

/**
 * Twilio signs the full URL it called, followed by every form field as
 * name-then-value in alphabetical order of the names, with HMAC-SHA1 and the
 * account's auth token as the key, then base64.
 */
export function twilioSignature(url: string, params: Record<string, string>, authToken: string): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

/** True when `signature` is what Twilio would have sent for this request. */
export function validTwilioSignature(
  urls: string[],
  params: Record<string, string>,
  signature: string | null,
  authToken: string | undefined,
): boolean {
  // No token means nothing can be verified, and "cannot verify" must not read as "fine".
  if (!authToken || !signature) return false;
  const given = Buffer.from(signature);
  return urls.some((url) => {
    const expected = Buffer.from(twilioSignature(url, params, authToken));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}

/**
 * The URLs a request might legitimately have been signed for.
 *
 * Twilio signs the address it was configured with, which is not necessarily
 * the one this server sees after the platform's proxy. The configured domain
 * is tried with and without "www", and the request's own URL as a last resort.
 */
export function candidateWebhookUrls(pathAndQuery: string, requestUrl: string): string[] {
  const out = new Set<string>([`${BASE_URL}${pathAndQuery}`]);
  out.add(`${BASE_URL.replace("://www.", "://")}${pathAndQuery}`);
  out.add(`${BASE_URL.replace("://", "://www.").replace("://www.www.", "://www.")}${pathAndQuery}`);
  out.add(requestUrl);
  return [...out];
}

/** The form body as a plain object. Twilio posts application/x-www-form-urlencoded. */
export async function formParams(req: Request): Promise<Record<string, string>> {
  const form = await req.formData();
  const out: Record<string, string> = {};
  form.forEach((v, k) => { if (typeof v === "string") out[k] = v; });
  return out;
}

/**
 * What a delivery error means, in words for the office.
 * Codes are Twilio's; the list is the ones that actually occur on SMS to people.
 */
const DELIVERY_ERRORS: Record<string, string> = {
  "21610": "the customer replied STOP and has opted out",
  "30003": "the phone was off or out of coverage",
  "30004": "the customer's carrier blocked it",
  "30005": "the number is not in service",
  "30006": "the number is a landline or cannot receive texts",
  "30007": "the carrier filtered it as spam",
  "30008": "the carrier gave no reason",
  "30034": "the sender number is not registered for this country",
};

export function deliveryErrorText(code: string | number | null | undefined): string | null {
  if (code === null || code === undefined || code === "") return null;
  return DELIVERY_ERRORS[String(code)] ?? `Twilio error ${code}`;
}

/** Statuses Twilio reports, in the order a message passes through them. */
export const SMS_STATUSES = ["queued", "sending", "sent", "delivered", "undelivered", "failed"] as const;

/** Where a text is no longer going to change. */
export function isFinalSmsStatus(status: string): boolean {
  return status === "delivered" || status === "undelivered" || status === "failed";
}
