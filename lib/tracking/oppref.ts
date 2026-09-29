/**
 * The OpenAI Ads click reference, kept from the landing page to the payment.
 *
 * An ad click arrives as `?oppref=XXXX` on whatever page the ad points at —
 * usually a destination or service page, not the booking form. The visitor
 * then browses, and by the time they reach /book the parameter is long gone
 * from the URL. Nothing in this codebase captured any URL parameter at all,
 * so every click identifier was lost on the first navigation.
 *
 * It is therefore read on the first page load anywhere on the site and kept
 * in localStorage. The booking flow never leaves elitebcn.info — SumUp's
 * card form is an iframe on our own /booking/pay page, not a redirect — so
 * localStorage survives the whole journey, including the payment.
 *
 * First write wins. A visitor who clicks a second ad mid-session keeps the
 * click that started the session, which is the one the booking belongs to.
 */

export const OPPREF_KEY = "elite_oppref";
export const OPPREF_PARAM = "oppref";

/** How long a click reference stays useful. Longer than any booking session. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface Stored {
  value: string;
  at: number;
}

/**
 * Anything longer or stranger than this is not a click reference, and an
 * unbounded string from a URL should not be written to storage or later
 * into a booking record.
 */
function clean(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v || v.length > 200) return null;
  // Click references are opaque tokens. Anything with markup or whitespace
  // in it did not come from an ad platform.
  if (!/^[\w.:~-]+$/.test(v)) return null;
  return v;
}

/**
 * Reads ?oppref= from the current URL and stores it if this is the first one
 * seen. Safe to call on every page load; does nothing when there is no
 * parameter and nothing stored.
 *
 * Returns the reference now in effect, or null.
 */
export function captureOppref(search?: string): string | null {
  if (typeof window === "undefined") return null;

  let incoming: string | null = null;
  try {
    incoming = clean(new URLSearchParams(search ?? window.location.search).get(OPPREF_PARAM));
  } catch {
    incoming = null;
  }

  const existing = readOppref();

  // First write wins: the click that started the session is the one the
  // booking belongs to.
  if (incoming && !existing) {
    try {
      const payload: Stored = { value: incoming, at: Date.now() };
      window.localStorage.setItem(OPPREF_KEY, JSON.stringify(payload));
    } catch {
      // Private mode, blocked storage, quota. Attribution is a nice-to-have;
      // it must never break a page.
    }
    return incoming;
  }

  return existing ?? incoming ?? null;
}

/** The stored click reference, or null when absent, expired or unreadable. */
export function readOppref(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OPPREF_KEY);
    if (!raw) return null;

    // Tolerate a bare string from any earlier shape rather than losing it.
    if (!raw.startsWith("{")) return clean(raw);

    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (typeof parsed.value !== "string") return null;
    if (typeof parsed.at === "number" && Date.now() - parsed.at > TTL_MS) {
      try { window.localStorage.removeItem(OPPREF_KEY); } catch { /* ignore */ }
      return null;
    }
    return clean(parsed.value);
  } catch {
    return null;
  }
}

/** Server-side validation of whatever the browser sent us. */
export function sanitiseOppref(raw: unknown): string | null {
  return typeof raw === "string" ? clean(raw) : null;
}
