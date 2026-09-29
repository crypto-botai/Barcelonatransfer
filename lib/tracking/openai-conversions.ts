/**
 * The OpenAI Ads Conversions API.
 *
 * Endpoint, authentication and payload follow the documented specification;
 * nothing here is inferred. Only the fields the specification defines are
 * sent, and no field is invented to fill a gap.
 *
 *   POST https://bzr.openai.com/v1/events?pid=<PIXEL_ID>
 *   Authorization: Bearer <OPENAI_CONVERSIONS_API_KEY>
 *
 *   { "events": [ { id, type, timestamp_ms, oppref, action_source,
 *                   source_url, data: { type, amount, currency } } ] }
 *
 * Only `order_created` goes through here, and only from
 * lib/payment-completion once SumUp's own API has answered PAID. The
 * browser cannot reach any of it: the key is a server-only environment
 * variable with no NEXT_PUBLIC_ prefix, so it is never bundled into client
 * JavaScript.
 *
 * Failure is never fatal. A conversion that does not send is a reporting
 * problem; a booking that fails to confirm because a marketing call threw
 * would be a business one.
 */

const ENDPOINT = "https://bzr.openai.com/v1/events";

export interface ConversionInput {
  /** booking.id — the event id, shared with the browser pixel. */
  eventId: string;
  /** "order_created". */
  eventType: string;
  /** What the card was actually charged, in major units. */
  amount: number;
  currency: string;
  /** The click reference exactly as it arrived. Never rewritten. */
  oppref?: string | null;
  /** The page the conversion belongs to. */
  sourceUrl: string;
  /** Milliseconds since epoch. Defaults to now. */
  timestampMs?: number;
  /** Validate the request without recording a conversion. */
  validateOnly?: boolean;
}

export type ConversionOutcome =
  | "sent"
  | "validated"
  | "not-configured"
  | "authentication-error"
  | "validation-error"
  | "rejected"
  | "transport-error";

export interface ConversionResult {
  ok: boolean;
  outcome: ConversionOutcome;
  /** Safe to log: never contains the key or any personal data. */
  detail?: string;
}

function credentials(): { key: string; pixelId: string } | null {
  const key     = process.env.OPENAI_CONVERSIONS_API_KEY?.trim();
  const pixelId = process.env.OPENAI_PIXEL_ID?.trim();
  if (!key || !pixelId) return null;
  return { key, pixelId };
}

/** True when both the key and the pixel id are present. */
export function openAiConversionsConfigured(): boolean {
  return credentials() !== null;
}

/**
 * Reports one conversion.
 *
 * `id` is sent so OpenAI deduplicates on its own side: if this runs twice
 * for one booking — a retried webhook, the reconcile cron racing the
 * success-page poll — the second report is the same conversion rather than
 * a second sale. It is the same id the browser pixel uses for the same
 * event, which is what lets the two be matched up.
 *
 * With `validateOnly` the request is checked and nothing is recorded, so a
 * live configuration can be tested against production without inventing a
 * sale.
 */
export async function sendOpenAiConversion(input: ConversionInput): Promise<ConversionResult> {
  const creds = credentials();
  if (!creds) {
    // Not an error. The site runs without an ads account attached, and every
    // preview deployment does.
    console.info("[conversions] not configured — no event sent for", input.eventId);
    return { ok: true, outcome: "not-configured" };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("pid", creds.pixelId);
  if (input.validateOnly) url.searchParams.set("validate_only", "true");

  const body = {
    events: [
      {
        id:            input.eventId,
        type:          input.eventType,
        timestamp_ms:  input.timestampMs ?? Date.now(),
        // Exactly as it arrived from the ad click. Omitted, not nulled, when
        // the booking came from organic traffic.
        ...(input.oppref ? { oppref: input.oppref } : {}),
        action_source: "web",
        source_url:    input.sourceUrl,
        data: {
          type:     "contents",
          amount:   input.amount,
          currency: input.currency,
        },
      },
    ],
  };

  try {
    // A marketing call must not hold a payment confirmation open.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${creds.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    const text = await res.text().catch(() => "");
    // The response is OpenAI's own error text. Truncated, and it never
    // contains our key or anything about the customer.
    const detail = text.slice(0, 300);

    if (res.status === 401 || res.status === 403) {
      console.error("[conversions] authentication error", res.status, "for", input.eventId, detail);
      return { ok: false, outcome: "authentication-error", detail };
    }

    if (res.status === 400 || res.status === 422) {
      console.error("[conversions] validation error", res.status, "for", input.eventId, detail);
      return { ok: false, outcome: "validation-error", detail };
    }

    if (!res.ok) {
      console.error("[conversions] rejected", res.status, "for", input.eventId, detail);
      return { ok: false, outcome: "rejected", detail };
    }

    // A 2xx can still report per-event failures in its body. Treat any
    // mention of a failed or rejected event as a rejection rather than
    // recording a success that did not happen.
    if (/"(errors|failed|rejected)"\s*:/.test(text) && !/"(errors|failed|rejected)"\s*:\s*(\[\s*\]|0|null|false)/.test(text)) {
      console.error("[conversions] event rejected by the API for", input.eventId, detail);
      return { ok: false, outcome: "rejected", detail };
    }

    if (input.validateOnly) {
      console.info("[conversions] validated (nothing recorded) for", input.eventId);
      return { ok: true, outcome: "validated", detail };
    }

    console.info("[conversions] sent", input.eventType, "for", input.eventId);
    return { ok: true, outcome: "sent" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[conversions] transport error for", input.eventId, detail);
    return { ok: false, outcome: "transport-error", detail };
  }
}
