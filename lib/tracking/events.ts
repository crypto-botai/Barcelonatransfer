/**
 * The three business events, sent once each, to whatever tags are loaded.
 *
 * Google's gtag.js is deliberately deferred to browser idle or first
 * interaction (components/layout/DeferredAnalytics), so `window.gtag` may
 * not exist yet when an event fires. Pushing onto `window.dataLayer`
 * directly works either way: gtag.js drains whatever is already in the array
 * when it loads. Nothing here waits for a script or fails if one never
 * arrives.
 *
 * `order_created` is the money event and is sent from the server, in
 * lib/payment-completion, after SumUp's own API has confirmed the payment.
 * The client copy here exists only to feed the Google Ads and GA4 tags,
 * which live in the browser, and it is gated on the server having already
 * said PAID — never on a widget callback or on arriving at a page.
 */

export type TrackedEvent = "booking_started" | "checkout_started" | "order_created";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/** Google Ads conversion labels, e.g. "AW-18391666445/AbCdEf...". */
const ADS_LABELS: Record<TrackedEvent, string | undefined> = {
  booking_started:  process.env.NEXT_PUBLIC_ADS_LABEL_BOOKING_STARTED,
  checkout_started: process.env.NEXT_PUBLIC_ADS_LABEL_CHECKOUT_STARTED,
  order_created:    process.env.NEXT_PUBLIC_ADS_LABEL_ORDER_CREATED,
};

export interface EventPayload {
  /** The booking this event belongs to. Also the conversion's event_id. */
  bookingId?: string | null;
  value?: number | null;
  currency?: string | null;
  oppref?: string | null;
}

/**
 * Events already sent in this tab.
 *
 * Belt and braces on top of the call sites: a React effect can run twice in
 * development, and a customer can reload the payment page. Keyed by event
 * plus booking so two different bookings in one session both report.
 */
const sentThisTab = new Set<string>();

/** sessionStorage survives a reload; the in-memory set covers the rest. */
function alreadySent(key: string): boolean {
  if (sentThisTab.has(key)) return true;
  try {
    if (window.sessionStorage.getItem(`elite_evt_${key}`)) {
      sentThisTab.add(key);
      return true;
    }
  } catch { /* storage blocked — the in-memory set still applies */ }
  return false;
}

function markSent(key: string): void {
  sentThisTab.add(key);
  try {
    window.sessionStorage.setItem(`elite_evt_${key}`, "1");
  } catch { /* ignore */ }
}

/**
 * Sends one business event, at most once per booking per session.
 *
 * Pushes a GA4 event and, when a conversion label is configured, a Google
 * Ads conversion. The Ads conversion carries `transaction_id` so Google
 * deduplicates it on its own side as well.
 */
export function track(event: TrackedEvent, payload: EventPayload = {}): void {
  if (typeof window === "undefined") return;

  const key = `${event}_${payload.bookingId ?? "anon"}`;
  if (alreadySent(key)) return;
  markSent(key);

  const value    = typeof payload.value === "number" ? payload.value : undefined;
  const currency = payload.currency ?? "EUR";

  try {
    window.dataLayer = window.dataLayer || [];

    // GA4: the event under its own name, for reporting and audiences.
    window.dataLayer.push({
      event,
      booking_id: payload.bookingId ?? undefined,
      oppref:     payload.oppref ?? undefined,
      value,
      currency,
    });

    // Google Ads: a conversion, only when a label has been configured for
    // this event. Without a label there is nothing for Ads to record, and
    // sending one anyway would be a silent no-op.
    const label = ADS_LABELS[event];
    if (label) {
      window.dataLayer.push([
        "event",
        "conversion",
        {
          send_to:        label,
          value,
          currency,
          // Google's own deduplication key. Same booking, same id, whether
          // the page is reloaded or the event arrives twice.
          transaction_id: payload.bookingId ?? undefined,
        },
      ]);
    }
  } catch {
    // Tracking must never break the booking flow.
  }
}

/** For tests and for the rare case a page needs to re-arm an event. */
export function resetTrackingForTests(): void {
  sentThisTab.clear();
}
