/**
 * Turning what a customer typed into something the office can tap.
 *
 * The booking form has a country picker and emits E.164, but the session
 * endpoint that records a lead accepts any string, and what arrived was
 * mixed: "+17025386800" beside "2036230511" and "14033489766". A number with
 * no dialling code is not a number anyone in Barcelona can ring, and the
 * WhatsApp link built from it — wa.me/2036230511 — points at nothing at all
 * and fails silently when tapped.
 *
 * Nothing here guesses a country. A bare ten-digit number could be almost
 * anywhere, and a wrong guess is worse than an honest gap: it produces a link
 * that looks right, dials someone else, and hides the fact that the lead was
 * never reachable. What it does instead is normalise the cases that are
 * unambiguous, and say plainly when a number is not dialable so the office
 * can see why before wasting a call on it.
 */

/** Digits and a single leading plus. Nothing else survives. */
function clean(raw: string | null | undefined): string {
  return String(raw ?? "").trim().replace(/[^\d+]/g, "");
}

/**
 * E.164 when that can be known for certain, otherwise null.
 *
 * "00" is the international prefix across Europe and unambiguously means the
 * same thing as "+", so it is converted. Everything else either already
 * carries a plus or is left alone.
 */
export function toE164(raw: string | null | undefined): string | null {
  let s = clean(raw);
  if (!s) return null;

  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (!s.startsWith("+")) return null;

  const digits = s.slice(1);
  // ITU-T E.164: at most fifteen digits, and nothing under eight is a real
  // international number.
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `+${digits}`;
}

/** True when the number can actually be dialled from anywhere. */
export function isDialable(raw: string | null | undefined): boolean {
  return toE164(raw) !== null;
}

/** A tel: href, or null when there is nothing worth linking. */
export function telHref(raw: string | null | undefined): string | null {
  const e = toE164(raw);
  if (e) return `tel:${e}`;
  // A local number is still worth a link for whoever is in that country; it
  // just cannot be promised to work from here.
  const s = clean(raw);
  return s.length >= 6 ? `tel:${s}` : null;
}

/**
 * A wa.me link, or null.
 *
 * Only for a number that is genuinely international. wa.me silently resolves
 * a malformed number to nothing, so a link built from a local number is worse
 * than no link: it looks like a way to reach somebody and is not.
 */
export function waHref(raw: string | null | undefined): string | null {
  const e = toE164(raw);
  return e ? `https://wa.me/${e.slice(1)}` : null;
}

/** What to show a human, with a note when it cannot be dialled. */
export function displayPhone(raw: string | null | undefined): { text: string; dialable: boolean } {
  const s = String(raw ?? "").trim();
  if (!s) return { text: "—", dialable: false };
  const e = toE164(s);
  return e ? { text: e, dialable: true } : { text: s, dialable: false };
}
