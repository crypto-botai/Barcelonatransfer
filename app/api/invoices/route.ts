import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issueInvoice, formatInvoiceNumber } from "@/lib/invoices";

export const dynamic = "force-dynamic";

const schema = z.object({
  bookingId: z.string().min(1),
  /** Optional: included in the returned link so a guest can open the invoice. */
  code:      z.string().min(1).optional(),
  taxId:     z.string().max(40).optional(),
  address:   z.string().max(200).optional(),
  name:      z.string().max(120).optional(),
});

/**
 * Requests a VAT invoice for a booking.
 *
 * Fares exclude VAT, so this is what adds the 10% — issuing an invoice is a
 * deliberate act, not a view of an existing document.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { bookingId, code, taxId, address, name } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: {
      id: true, userId: true, confirmationCode: true,
      guestName: true, paymentStatus: true,
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Issuing is admin-only, by operator decision.
  //
  // Every invoice issued creates a VAT liability and consumes a number in a
  // sequence that legally cannot have gaps, so the operator approves each one
  // rather than letting customers mint their own. Customers ask on WhatsApp —
  // their bookings page opens a pre-filled message.
  //
  // The rendered document at /booking/[id]/invoice is admin-only too, so no
  // part of the invoice system is reachable by a customer.
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Invoicing an unpaid booking would put a tax document into the sequence for
  // money that has not been received.
  if (booking.paymentStatus !== "PAID") {
    return NextResponse.json(
      { error: "An invoice can only be issued once the booking is paid." },
      { status: 409 },
    );
  }

  try {
    const invoice = await issueInvoice({
      bookingId,
      customerName:    name ?? booking.guestName ?? "Customer",
      customerTaxId:   taxId ?? null,
      customerAddress: address ?? null,
    });

    return NextResponse.json({
      ok: true,
      reference: formatInvoiceNumber(invoice.series, invoice.year, invoice.number),
      net:   invoice.netAmount,
      vat:   invoice.vatAmount,
      gross: invoice.grossAmount,
      url:   `/booking/${bookingId}/invoice${code ? `?code=${encodeURIComponent(code)}` : ""}`,
    });
  } catch (e) {
    console.error("[invoices] issue failed:", e);
    return NextResponse.json({ error: "Could not issue invoice" }, { status: 500 });
  }
}
