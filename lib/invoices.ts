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
  /**
   * The legal person issuing the invoice.
   *
   * For a sole trader (autónomo) this is the individual's own name, not the
   * brand — Spanish invoicing rules require "nombre y apellidos" for a persona
   * física. The trading name goes in tradeName alongside it.
   */
  legalName: string;
  /** Nombre comercial. Optional, shown next to the legal name. */
  tradeName: string | null;
  taxId: string | null;
  address: string | null;
  email: string;
}

const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/**
 * Validates a Spanish NIF, NIE or CIF check character.
 *
 * A tax number with a transposed digit looks completely normal but makes every
 * invoice issued against it invalid. Checking it costs nothing and catches the
 * typo at configuration time rather than at an inspection.
 */
export function isValidSpanishTaxId(raw: string): boolean {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^ES/, "");

  if (/^\d{8}[A-Z]$/.test(s)) {
    return s[8] === NIF_LETTERS[parseInt(s.slice(0, 8), 10) % 23];
  }
  if (/^[XYZ]\d{7}[A-Z]$/.test(s)) {
    const n = parseInt(String("XYZ".indexOf(s[0])) + s.slice(1, 8), 10);
    return s[8] === NIF_LETTERS[n % 23];
  }
  // CIF check digit varies by entity type; accept a well-formed one rather than
  // rejecting a valid company number this simplified check cannot verify.
  return /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(s);
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
    legalName: envOrNull("COMPANY_LEGAL_NAME") ?? "Elite BCN Transfers",
    tradeName: envOrNull("COMPANY_TRADE_NAME"),
    taxId:     envOrNull("COMPANY_TAX_ID"),
    address:   envOrNull("COMPANY_ADDRESS"),
    email:     envOrNull("NEXT_PUBLIC_CONTACT_EMAIL") ?? "vtcbcn2025@gmail.com",
  };
}

/**
 * Whether the issuer block satisfies the minimum a Spanish invoice needs.
 *
 * The tax number must also pass its check character — a malformed one is worse
 * than a missing one, because the invoice looks complete while being invalid.
 */
export function isIssuerComplete(issuer = getIssuer()): boolean {
  return Boolean(issuer.taxId && isValidSpanishTaxId(issuer.taxId) && issuer.address);
}

/** What is still missing, for a precise on-screen warning. */
export function missingIssuerFields(issuer = getIssuer()): string[] {
  const missing: string[] = [];
  if (!issuer.taxId) missing.push("tax number (NIF/CIF)");
  else if (!isValidSpanishTaxId(issuer.taxId)) missing.push("a valid tax number — the one configured fails its check character");
  if (!issuer.address) missing.push("registered address");
  return missing;
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
