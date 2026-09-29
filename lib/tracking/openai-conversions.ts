/**
 * The OpenAI Ads conversion, sent from the server.
 *
 * Only `order_created` goes through here, and only from
 * lib/payment-completion after SumUp's own API has answered PAID. Nothing in
 * the browser can reach this: the credentials are server-only environment
 * variables with no NEXT_PUBLIC_ prefix, so they are never bundled into
 * client JavaScript.
 *
 * The endpoint is configurable because OpenAI's conversions API is new and
 * its host may move; `OPENAI_CONVERSIONS_ENDPOINT` overrides the default
 * without a deploy of this file.
 *
 * Failure is never fatal. A conversion that does not send is a reporting
 * problem; a booking that does not confirm because a marketing pixel threw
 * is a business problem. Everything here is caught and logged.
 */

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/ads/conversions";

export interface ConversionInput {
  /** booking.id — the idempotency key on both sides. */
  eventId: string;
  /** Always "order_created" today; typed loosely for future events. */
  eventName: string;
  /** What was actually charged online, in major units. */
  value: number;
  currency: string;
  /** The ad click this booking came from, when there was one. */
  oppref?: string | null;
  /** Seconds since epoch. Defaults to now. */
  occurredAt?: number;
}

export type ConversionResult =
  | { ok: true; skipped?: "not-configured" }
  | { ok: false; error: string };

function credentials(): { key: string; endpoint: string; advertiserId?: string } | null {
  const key = process.env.OPENAI_ADS_API_KEY?.trim();
  if (!key) return null;
  return {
    key,
    endpoint: process.env.OPENAI_CONVERSIONS_ENDPOINT?.trim() || DEFAULT_ENDPOINT,
    advertiserId: process.env.OPENAI_ADS_ADVERTISER_ID?.trim() || undefined,
  };
}

/** True when the conversion API has been configured at all. */
export function openAiConversionsConfigured(): boolean {
  return credentials() !== null;
}

/**
 * Reports one conversion.
 *
 * `event_id` is sent so OpenAI deduplicates on its own side too: if this is
 * ever called twice for the same booking — a retried webhook, a cron sweep
 * racing the success-page poll — the second report is the same conversion,
 * not a second sale.
 */
export async function sendOpenAiConversion(input: ConversionInput): Promise<ConversionResult> {
  const creds = credentials();
  if (!creds) {
    // Not configured is not an error: the site runs perfectly well without
    // an ads account attached, and every preview deployment does.
    return { ok: true, skipped: "not-configured" };
  }

  const body: Record<string, unknown> = {
    event_name: input.eventName,
    event_id:   input.eventId,
    event_time: input.occurredAt ?? Math.floor(Date.now() / 1000),
    value:      input.value,
    currency:   input.currency,
    ...(input.oppref ? { oppref: input.oppref } : {}),
    ...(creds.advertiserId ? { advertiser_id: creds.advertiserId } : {}),
  };

  try {
    // A marketing call must not hold a payment confirmation open. Ten
    // seconds is generous for one POST; past that the conversion is lost
    // and the booking carries on.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(creds.endpoint, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${creds.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Never log the key, and keep the body short: it is a third party's
      // error message, not something to dump into the function log whole.
      return { ok: false, error: `HTTP ${res.status} ${text.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
