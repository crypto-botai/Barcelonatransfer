/**
 * Booking confirmation codes.
 *
 * The old generator built a code from the last six digits of the customer's
 * phone number plus two letters drawn from a 24-letter alphabet. That gave only
 * 24 × 24 = 576 possible codes for any given phone number, which caused two
 * distinct problems:
 *
 *  1. Collisions hard-failed the booking. `confirmationCode` is UNIQUE, so a
 *     repeat draw threw a Prisma unique-constraint error, the route returned
 *     500, no booking row was written, and no confirmation or admin alert email
 *     was ever sent. The customer saw a payment error and the operator saw
 *     nothing at all — a silently lost sale.
 *
 *  2. The code is used as a bearer token. Journey tracking, the receipt page
 *     and the balance-payment endpoint all authorise on possession of it. With
 *     six of the eight characters derivable from the customer's own phone
 *     number, anyone holding that number needed at most 576 guesses to read
 *     their name, email, home address, flight number and live driver location.
 *
 * Codes are now drawn from a CSPRNG over an unambiguous 32-character alphabet.
 * Ten characters gives 32^10 ≈ 1.1 × 10^15 combinations and reveals nothing
 * about the customer.
 *
 * Existing codes keep working: lookups match on value, never on shape.
 */

import { randomInt } from "crypto";

/**
 * Crockford-style alphabet. I, O, 0 and 1 are omitted — these codes get read
 * aloud down a phone line and written on paper, where those characters are
 * routinely confused for one another.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 10;

/** A fresh, unguessable confirmation code. */
export function generateBookingCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    // randomInt is cryptographically secure; Math.random is not, and this value
    // guards access to a customer's personal data.
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/** True when an error is Prisma's unique-constraint violation on confirmationCode. */
function isCodeCollision(e: unknown): boolean {
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err?.code !== "P2002") return false;
  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  return fields.some((f) => f.toLowerCase().includes("confirmationcode"));
}

/**
 * Runs `create` with a fresh code, retrying if that code is already taken.
 *
 * At this entropy a collision is vanishingly unlikely, but a uniqueness
 * constraint should never be the thing that loses a paid booking. Only a
 * genuine code collision is retried — any other database error propagates
 * immediately rather than being swallowed by the loop.
 */
export async function withUniqueBookingCode<T>(
  create: (code: string) => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await create(generateBookingCode());
    } catch (e) {
      if (!isCodeCollision(e)) throw e;
      lastError = e;
      console.warn(`[booking-code] collision on attempt ${i + 1}, retrying`);
    }
  }

  throw lastError;
}
