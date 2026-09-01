import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The passenger's link.
 *
 * Server-only, and deliberately kept out of lib/arrival.ts so that the stage
 * definitions can be imported by a client component without pulling node:crypto
 * into the browser bundle.
 *
 * The token is signed rather than stored: `<bookingId>.<hmac>`. That means no
 * new column, no lookup table, and no way to enumerate other people's bookings
 * by editing the URL — a booking id on its own is worthless without the
 * signature, and the signature cannot be produced without the server secret.
 *
 * There is no expiry in the token. The link is only useful while a passenger is
 * walking through an airport, and the page itself refuses to serve a booking
 * whose pickup was long ago, which is a better place for that rule: it can be
 * changed without invalidating links already sitting in people's inboxes.
 */

function secret(): string {
  // Signing with a fallback that ships in the repo would let anyone mint a link
  // for any booking, so an unset secret is a hard failure rather than a default.
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set — cannot sign arrival links");
  return s;
}

function sign(bookingId: string): string {
  return createHmac("sha256", secret())
    .update(`arrival:${bookingId}`)
    .digest("base64url")
    .slice(0, 32);
}

export function signArrivalToken(bookingId: string): string {
  return `${bookingId}.${sign(bookingId)}`;
}

/** The booking id inside a token, or null if it was not signed by us. */
export function verifyArrivalToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const bookingId = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(bookingId);
  } catch {
    return null;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Compare in constant time, and only once the lengths match — timingSafeEqual
  // throws rather than returning false when they differ.
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? bookingId : null;
}

/** The absolute link to give a passenger. */
export function arrivalUrl(bookingId: string, siteUrl?: string): string {
  const base = siteUrl ?? process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";
  return `${base.replace(/\/$/, "")}/arrival/${signArrivalToken(bookingId)}`;
}
