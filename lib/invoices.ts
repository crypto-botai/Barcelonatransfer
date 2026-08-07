/**
 * VAT invoicing.
 *
 * The site charges fares excluding VAT and adds 10% only when a customer asks
 * for an invoice, so an invoice is a distinct document issued on request — not
 * a reformatting of the receipt.
 *
 * Spanish invoicing rules require numbers to run sequentially within a series
 * with no gaps, so the number is allocated from the invoices table inside a
 * transaction at the moment of issue. Deriving it from a booking id, a count,
 * or a timestamp would eventually produce a duplicate or a gap.
 */

import { prisma } from "@/lib/prisma";

/** Spanish reduced rate for passenger transport. */
export const VAT_RATE = 10;

export interface IssuerDetails {
  legalName: string;
  taxId: string | null;
  address: string | null;
  email: string;
}

/**
 * Who the invoice is from.
 *
 * A Spanish invoice is not valid without the issuer's NIF/CIF and registered
 * address, and neither is in the codebase — they are business registration
 * details, not something to guess. They come from env so the owner can set them
 * without a deploy; until then the invoice renders but flags itself as
 * incomplete rather than inventing a tax number.
 */
/**
 * Reads an env var, treating blank and whitespace-only as unset.
 *
 * `??` alone only catches undefined, so a variable created in the dashboard but
 * left empty comes back as "" and passes every truthiness check downstream.
 * That is precisely how NEXT_PUBLIC_GOOGLE_MAPS_KEY sat "configured" with
 * placeholder text while silently failing every call.
 */
function envOrNull(name: string): string | null {
  const v = process.env[name]?.trim();
  return v ? v : null;
}

export function getIssuer(): IssuerDetails {
  return {
    legalName: envOrNull("COMPANY_LEGAL_NAME") ?? "Élite BCN Transfers",
    taxId:     envOrNull("COMPANY_TAX_ID"),
    address:   envOrNull("COMPANY_ADDRESS"),
    email:     envOrNull("NEXT_PUBLIC_CONTACT_EMAIL") ?? "vtcbcn2025@gmail.com",
  };
}

export function isIssuerComplete(issuer = getIssuer()): boolean {
  return Boolean(issuer.taxId && issuer.address);
}

/** Splits a VAT-exclusive fare into its invoice lines. */
export function vatBreakdown(netAmount: number, rate = VAT_RATE) {
  const net   = Math.round(netAmount * 100) / 100;
  const vat   = Math.round(net * (rate / 100) * 100) / 100;
  const gross = Math.round((net + vat) * 100) / 100;
  return { net, vat, gross, rate };
}

/** Human-readable reference, e.g. "A-2026-0007". */
export function formatInvoiceNumber(series: string, year: number, number: number): string {
  return `${series}-${year}-${String(number).padStart(4, "0")}`;
}

export interface IssueInput {
  bookingId: string;
  customerName: string;
  customerTaxId?: string | null;
  customerAddress?: string | null;
}

/**
 * Issues an invoice, or returns the one already issued for this booking.
 *
 * Idempotent by design: a customer clicking twice, or a retry after a timeout,
 * must not burn a second number. Re-requesting with new tax details updates
 * those details on the existing invoice rather than issuing a replacement,
 * since the number has already been reported.
 */
export async function issueInvoice(input: IssueInput) {
  const existing = await prisma.invoice.findUnique({ where: { bookingId: input.bookingId } });
  if (existing) {
    const wantsUpdate =
      (input.customerTaxId   && input.customerTaxId   !== existing.customerTaxId) ||
      (input.customerAddress && input.customerAddress !== existing.customerAddress);

    if (!wantsUpdate) return existing;

    return prisma.invoice.update({
      where: { bookingId: input.bookingId },
      data: {
        customerTaxId:   input.customerTaxId   ?? existing.customerTaxId,
        customerAddress: input.customerAddress ?? existing.customerAddress,
      },
    });
  }

  const booking = await prisma.booking.findUnique({
    where:  { id: input.bookingId },
    select: { id: true, totalAmount: true, paymentStatus: true },
  });
  if (!booking) throw new Error("Booking not found");

  const year   = new Date().getFullYear();
  const series = "A";
  const { net, vat, gross } = vatBreakdown(booking.totalAmount);

  // Allocate the next number and write the row in one transaction so two
  // simultaneous requests cannot read the same "last" number. The unique
  // constraint on (series, year, number) is the backstop if they still race.
  return prisma.$transaction(async (tx) => {
    const last = await tx.invoice.findFirst({
      where:   { series, year },
      orderBy: { number: "desc" },
      select:  { number: true },
    });

    return tx.invoice.create({
      data: {
        bookingId:       booking.id,
        series,
        year,
        number:          (last?.number ?? 0) + 1,
        netAmount:       net,
        vatRate:         VAT_RATE,
        vatAmount:       vat,
        grossAmount:     gross,
        customerName:    input.customerName,
        customerTaxId:   input.customerTaxId   ?? null,
        customerAddress: input.customerAddress ?? null,
      },
    });
  });
}
