import crypto from "node:crypto";

/**
 * Who may watch a ride without being signed in (the public /track/{code} page that the confirmation email links to).
 *
 * The old model: possession of the booking's confirmation code, forever. Problems: the code is printed in emails, WhatsApp
 * messages, driver and partner screens and PDFs, never expires, and (before this change) was made with Math.random.
 *
 * The model now:
 *  1. Preferred: a signed tracking token. The /track/{code} page (which still opens with the code, so every email and WhatsApp
 *     link keeps working) mints one for that booking, valid until 12 hours after the pickup time, and the page uses it for every
 *     position request. The token is an HMAC over the booking id and expiry, so it cannot be made without the server secret and
 *     cannot be reused for another booking.
 *  2. Legacy, still accepted so nothing breaks: the confirmation code sent directly to the tracking endpoint. It is compared in
 *     constant time, failed guesses are rate-limited per client, an unknown booking and a wrong code look the same, and it can be
 *     switched off with TRACKING_ALLOW_CODE=0 once no old client uses it.
 * Either way the endpoint still only answers while the ride is assigned or in progress.
 */

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}

const mac = (payload: string) => crypto.createHmac("sha256", secret()).update(`track.${payload}`).digest("base64url");

export const TRACKING_TOKEN_AFTER_PICKUP_MS = 12 * 3600_000;

export function signTrackingToken(bookingId: string, pickupAt: Date, now = Date.now()): string {
  // Valid until 12 hours after the pickup, and for at least an hour from now (a booking made for 'right now' still works).
  const exp = Math.max(pickupAt.getTime() + TRACKING_TOKEN_AFTER_PICKUP_MS, now + 3600_000);
  const payload = b64(JSON.stringify({ b: bookingId, x: exp }));
  return `${payload}.${mac(payload)}`;
}

export function verifyTrackingToken(token: string, bookingId: string, now = Date.now()): boolean {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  let expected: string;
  try {
    expected = mac(payload);
  } catch {
    return false;
  }
  if (!safeEqual(sig, expected)) return false;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { b?: string; x?: number };
    return d.b === bookingId && typeof d.x === "number" && d.x > now;
  } catch {
    return false;
  }
}

/** Constant-time string comparison (different lengths are simply unequal). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Whether the bare confirmation code is still accepted by the tracking endpoint. On by default for backward compatibility. */
export function codeAccessAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.TRACKING_ALLOW_CODE !== "0";
}

/* Failed-guess limiter: at most 20 wrong attempts per client per 10 minutes (per server instance). */
const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 20;
const fails = new Map<string, { start: number; n: number }>();

export function tooManyFailures(client: string, now = Date.now()): boolean {
  const e = fails.get(client);
  return !!e && now - e.start < WINDOW_MS && e.n >= MAX_FAILS;
}

export function recordFailure(client: string, now = Date.now()): void {
  const e = fails.get(client);
  if (!e || now - e.start >= WINDOW_MS) fails.set(client, { start: now, n: 1 });
  else e.n++;
  if (fails.size > 5000) fails.clear();
}

export function resetTrackingLimiter(): void {
  fails.clear();
}
