/**
 * VAT arithmetic, shared by the booking form and the server.
 *
 * This lives apart from lib/invoices.ts because that module imports Prisma and
 * so cannot be pulled into a client component. The booking form needs the rate
 * and the rounding to show the customer the same figure the server will charge;
 * two implementations of "add 10%" would eventually disagree by a cent, and the
 * cent would be the difference between the card total and the invoice.
 *
 * Fares on this site are quoted excluding VAT. Spanish law only requires an
 * invoice on request for a passenger transport service like this one, so the
 * 10% is collected only from customers who ask for one, at the point of
 * booking — not added afterwards to a payment that has already been taken.
 */

/** Spanish reduced rate for passenger transport, as a percentage. */
export const VAT_RATE = 10;

/** Catalogue id of the "I need an invoice" option in EXTRAS_CATALOG. */
export const INVOICE_EXTRA_ID = "invoice_vat";

/** True when the chosen extras include the invoice request. */
export function wantsInvoice(
  extras: readonly { id: string }[] | undefined | null,
): boolean {
  return (extras ?? []).some((e) => e.id === INVOICE_EXTRA_ID);
}

/** VAT due on a net amount, rounded to the cent. */
export function vatOn(netAmount: number, rate = VAT_RATE): number {
  if (!Number.isFinite(netAmount) || netAmount <= 0) return 0;
  return Math.round(netAmount * (rate / 100) * 100) / 100;
}

/**
 * Splits a VAT-inclusive total back into its net and VAT parts.
 *
 * Used when issuing an invoice for a booking that already collected the VAT:
 * the gross is what the customer actually paid, and net + vat must add back up
 * to exactly that figure, so the VAT is taken as the remainder rather than
 * recomputed. Recomputing it lets a rounded net and a rounded VAT sum to a cent
 * either side of the amount on the card statement.
 */
export function splitGross(grossAmount: number, rate = VAT_RATE) {
  const gross = Math.round(grossAmount * 100) / 100;
  const net = Math.round((gross / (1 + rate / 100)) * 100) / 100;
  const vat = Math.round((gross - net) * 100) / 100;
  return { net, vat, gross, rate };
}
