/**
 * The address email is sent from.
 *
 * RESEND_FROM was, briefly and in production, set to the Resend API key —
 * pasted into the field above the one it was meant for. Every send then
 * carried a from address beginning "re_", which is not an address, and the whole
 * system's outgoing email depended on one value in a dashboard being typed
 * into the right box.
 *
 * An environment variable that can silently disable every email in the
 * business should not be trusted without looking at it. If it does not
 * resemble an address, it is ignored and the built-in sender is used
 * instead, with a line in the log saying so. A wrong sender is a
 * configuration mistake; it should not also be an outage.
 */

const DEFAULT_FROM = "Elite BCN Transfers <noreply@elitebcn.info>";

/**
 * Accepts "someone@example.com" and "Name <someone@example.com>", which are
 * the two forms Resend takes. Deliberately loose — the job here is to catch
 * something that is obviously not an address, not to adjudicate RFC 5322.
 */
function looksLikeSender(v: string): boolean {
  const addr = v.includes("<") ? v.slice(v.lastIndexOf("<") + 1, v.lastIndexOf(">")) : v;
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(addr.trim());
}

let warned = false;

/** The configured sender, or the built-in one when that is not usable. */
export function senderAddress(fallback = DEFAULT_FROM): string {
  const raw = process.env.RESEND_FROM?.trim();
  if (!raw) return fallback;
  if (looksLikeSender(raw)) return raw;

  if (!warned) {
    warned = true;
    // Never print the value: the way this went wrong is that the value was a
    // secret. Say what is wrong and what was used instead.
    console.error(
      "[email] RESEND_FROM is not an email address and has been ignored; " +
      `sending as ${fallback}. Check the variable in the hosting dashboard.`,
    );
  }
  return fallback;
}

/** True when RESEND_FROM is set but unusable, for the admin diagnostic. */
export function senderIsMisconfigured(): boolean {
  const raw = process.env.RESEND_FROM?.trim();
  return Boolean(raw) && !looksLikeSender(raw!);
}
