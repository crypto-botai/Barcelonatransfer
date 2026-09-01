/**
 * Driver gratuity.
 *
 * SumUp's own tipping prompt belongs to its card terminals, not to the hosted
 * checkout this site sends customers to, so a tip added there would never reach
 * us. Even if it did, it would arrive as part of an opaque payment total with
 * nothing on the booking to say a tip had been left — and the driver it is
 * meant for would never be told. So the tip is collected here, added to the
 * amount SumUp is asked to charge, and recorded on the booking.
 *
 * Two rules the arithmetic has to respect:
 *
 * A tip is not consideration for the transport, so it carries no VAT and never
 * appears on the invoice. A voluntary gratuity is outside the scope of Spanish
 * VAT; putting it inside the taxable base would overstate the tax due and print
 * a figure on a tax document that does not belong there.
 *
 * A coupon discounts the fare, never the tip. The customer chose the tip after
 * the discount was applied, and quietly shaving a percentage off it would take
 * money from the driver rather than from the business offering the discount.
 */

/** Offered percentages. 0 is "no tip" and is the default. */
export const TIP_PRESETS = [0, 5, 10, 15] as const;

/**
 * Ceiling on a custom tip.
 *
 * Generous enough never to block a real gratuity, low enough that a mistyped
 * amount — a customer meaning €20 and typing 2000 — is caught before it reaches
 * the card. The fare itself is the other bound: a tip larger than the whole
 * journey is far more likely to be a typo than an intention.
 */
export const MAX_TIP_ABSOLUTE = 500;

/** The tip due at a preset percentage of the fare. */
export function tipForPercent(netAmount: number, percent: number): number {
  if (!Number.isFinite(netAmount) || netAmount <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round(netAmount * (percent / 100) * 100) / 100;
}

/**
 * A tip the server is willing to charge.
 *
 * Unlike the extras, a tip has no catalogue to price it from — the amount is
 * genuinely the customer's to choose, so it cannot be recomputed server-side
 * and can only be bounds-checked. Anything unparseable, negative or absurd
 * becomes no tip rather than an error, because a bad tip value is never a
 * reason to lose the booking.
 */
export function clampTip(raw: unknown, netAmount: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const ceiling = Math.min(MAX_TIP_ABSOLUTE, Math.max(netAmount, 50));
  return Math.round(Math.min(n, ceiling) * 100) / 100;
}
