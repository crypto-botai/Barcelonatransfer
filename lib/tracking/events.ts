/**
 * The three business events, sent once each, to whatever tags are loaded.
 *
 * Everything here goes through `gtag()`. That is not a style preference: this
 * site runs gtag.js, not Google Tag Manager, and gtag.js processes *only*
 * `arguments` objects found on `window.dataLayer`. A plain object
 * (`dataLayer.push({ event: "order_created" })`) or a plain array
 * (`dataLayer.push(["event", "conversion", {…}])`) is Tag Manager's syntax;
 * gtag.js ignores both silently — no error, no warning, no request.
 *
 * An earlier version of this file used exactly those two forms, so every GA4
 * event and every Ads conversion was a no-op. Measured against the live site
 * with five probes, watching the network:
 *
 *   dataLayer.push({ event: "x", … })        → no request
 *   dataLayer.push(["event", "x", { … }])    → no request
 *   gtag("event", "x", { … })                → /g/collect and /ccm/collect
 *   dataLayer.push(arguments)                → /g/collect and /ccm/collect
 *
 * The shim and both `config` commands are emitted inline in the document head
 * (app/layout.tsx), so `window.gtag` exists before any of this can run and
 * the config commands are already ahead of our events in the queue. gtag.js
 * itself is still deferred; commands queue until it arrives and are then
 * drained in order.
 *
 * `order_created` is the money event and is *also* sent from the server, in
 * lib/payment-completion, after SumUp's own API has confirmed the payment.
 * The client copy here exists only to feed the Google Ads and GA4 tags, which
 * live in the browser, and it is gated on the server having already said PAID
 * — never on a widget callback or on arriving at a page.
 */

export type TrackedEvent = "booking_started" | "checkout_started" | "order_created";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Ads conversion labels ("AW-<account>/<label>").
 *
 * These are public: they sit in every page's network traffic, so they are
 * written here rather than in Vercel. An env var still wins, which lets a
 * label be swapped or switched off ("" disables it) without a code change.
 * Found in Google Ads > Goals > Conversions > the action > Data sources >
 * Manage > See event snippet. Checkout has no Ads conversion action.
 */
const fromEnv = (value: string | undefined, fallback: string | undefined) => (value === undefined ? fallback : value || undefined);

const ADS_LABELS: Record<TrackedEvent, string | undefined> = {
  booking_started:  fromEnv(process.env.NEXT_PUBLIC_ADS_LABEL_BOOKING_STARTED,  "AW-18391666445/XgujCNj0_IodEI2e6sFE"),
  checkout_started: fromEnv(process.env.NEXT_PUBLIC_ADS_LABEL_CHECKOUT_STARTED, undefined),
  order_created:    fromEnv(process.env.NEXT_PUBLIC_ADS_LABEL_ORDER_CREATED,    "AW-18391666445/iwx8CNL0_IodEI2e6sFE"),
};

export interface EventPayload {
  /** The booking this event belongs to. Also the conversion's event_id. */
  bookingId?: string | null;
  value?: number | null;
  currency?: string | null;
  oppref?: string | null;
}

/**
 * Sends one gtag command.
 *
 * Prefers the shim installed in the head. The fallback matters only if that
 * snippet was blocked or stripped: it reproduces the shim exactly, pushing an
 * `arguments` object rather than an array, because an array would be ignored.
 */
function gtagCommand(...args: unknown[]): void {
  if (typeof window.gtag === "function") {
    window.gtag(...args);
    return;
  }
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  (function () { window.dataLayer!.push(arguments); }).apply(null, args as []);
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
 * Sends a GA4 event and, when a conversion label is configured, a Google Ads
 * conversion. The Ads conversion carries `transaction_id` so Google
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
    // GA4: the event under its own name, for reporting and audiences.
    gtagCommand("event", event, {
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
      gtagCommand("event", "conversion", {
        send_to:        label,
        value,
        currency,
        // Google's own deduplication key. Same booking, same id, whether
        // the page is reloaded or the event arrives twice.
        transaction_id: payload.bookingId ?? undefined,
      });
    }
  } catch {
    // Tracking must never break the booking flow.
  }
}

/** For tests and for the rare case a page needs to re-arm an event. */
export function resetTrackingForTests(): void {
  sentThisTab.clear();
}
