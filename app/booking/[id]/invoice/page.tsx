import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company-facts";
import { authOptions } from "@/lib/auth";
import { getIssuer, isIssuerComplete, missingIssuerFields, formatInvoiceNumber, vatBreakdown } from "@/lib/invoices";

export const dynamic = "force-dynamic";

// A receipt carries the customer's name, email, phone and home address. It must
// never be indexed, and must not leak through a referrer header either.
export const metadata: Metadata = {
  title: { absolute: "Receipt | Élite BCN" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Booking receipt, and VAT invoice when one has been issued.
 *
 * Access control: this page previously had none at all. Any booking id rendered
 * the customer's full name, email address, phone number, pickup address and
 * flight number to anyone who asked. It now requires the booking's confirmation
 * code — which the customer has, and which is a cuid rather than a guessable
 * sequence — or an authorised session.
 *
 *   /booking/{id}/invoice?code=XXXX
 */
export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { id } = await params;
  const { code } = await searchParams;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true, confirmationCode: true, userId: true,
      guestName: true, guestEmail: true, guestPhone: true,
      pickupAddress: true, dropoffAddress: true, pickupDatetime: true,
      passengers: true, luggage: true, vehicleClass: true,
      flightNumber: true, specialRequests: true,
      baseFare: true, distanceFare: true, airportSurcharge: true, nightSurcharge: true,
      totalAmount: true, currency: true, status: true, paymentStatus: true,
      distanceKm: true, durationMin: true, createdAt: true,
    },
  });

  if (!booking) notFound();

  // Admin only, by operator decision.
  //
  // Nothing on this page is printable by a customer. Invoices are tax documents
  // issued under the operator's own NIF and against their own numbering
  // sequence, so the entire document — receipt and invoice alike — is produced
  // and sent by hand rather than self-served from the website. Customers who
  // need either ask on WhatsApp.
  //
  // This previously accepted the booking's confirmation code, which let any
  // customer open and print their own copy.
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  // 404 rather than 403: confirming that a booking id exists is itself a small
  // disclosure, and there is nothing useful an unauthorised visitor can do.
  if (user?.role !== "ADMIN") notFound();

  const invoice = await prisma.invoice.findUnique({ where: { bookingId: id } });
  const issuer  = getIssuer();
  const isVat   = invoice !== null;

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: booking.currency }).format(n);

  const dateStr = new Date(booking.pickupDatetime).toLocaleString("en-GB", { timeZone: "Europe/Madrid",
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const issuedDate = new Date(invoice?.issuedAt ?? booking.createdAt).toLocaleDateString("en-GB", {
    year: "numeric", month: "long", day: "numeric",
  });

  const vehicleLabel: Record<string, string> = {
    ECONOMY: "Economy", BUSINESS: "Business Class", LUXURY: "Luxury",
    FIRST_CLASS: "First Class", ELECTRIC_VIP: "Electric VIP",
    SUV: "SUV", LUXURY_SUV: "Luxury SUV",
    MINIVAN: "Minivan", LUXURY_MINIVAN: "Luxury Minivan", MINIBUS: "Minibus",
  };

  const lineItems = [
    { label: "Base fare",             amount: booking.baseFare,         show: booking.baseFare > 0 },
    { label: "Distance fare",         amount: booking.distanceFare,     show: booking.distanceFare > 0 },
    { label: "Airport surcharge",     amount: booking.airportSurcharge, show: booking.airportSurcharge > 0 },
    { label: "Night/early surcharge", amount: booking.nightSurcharge,   show: booking.nightSurcharge > 0 },
  ].filter((i) => i.show);

  const totals = invoice
    ? { net: invoice.netAmount, vat: invoice.vatAmount, gross: invoice.grossAmount, rate: invoice.vatRate }
    : vatBreakdown(booking.totalAmount);

  const docTitle = isVat ? "INVOICE" : "RECEIPT";
  const docRef = invoice
    ? formatInvoiceNumber(invoice.series, invoice.year, invoice.number)
    : booking.confirmationCode.slice(0, 12).toUpperCase();

  return (
    <>
      {/* Self-contained CSS. The Google Fonts @import that was here is gone --
          it is a paid-vendor dependency this business does not use, and a
          render-blocking request that silently falls back when unreachable. */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #fff; color: #111; }
        .page { max-width: 760px; margin: 0 auto; padding: 48px 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #b8962e; padding-bottom: 24px; gap: 24px; }
        .logo-mark { width: 32px; height: 32px; border: 2px solid #b8962e; transform: rotate(45deg); display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
        .logo-dot { width: 10px; height: 10px; background: #b8962e; }
        .logo-text { font-size: 22px; font-weight: 700; letter-spacing: 0.15em; }
        .logo-text .gold { color: #b8962e; }
        .issuer { font-size: 11px; color: #888; margin-top: 4px; line-height: 1.6; }
        .invoice-meta { text-align: right; }
        .invoice-meta h1 { font-size: 28px; font-weight: 700; letter-spacing: 0.05em; }
        .invoice-meta .code { font-size: 13px; color: #666; margin-top: 4px; font-family: ui-monospace, Menlo, Consolas, monospace; }
        .invoice-meta .date { font-size: 12px; color: #888; margin-top: 2px; }
        .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #888; font-weight: 600; margin-bottom: 8px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
        .info-block p { font-size: 14px; line-height: 1.7; color: #333; }
        .info-block strong { color: #111; }
        .route-block { background: #f9f7f0; border-left: 3px solid #b8962e; padding: 16px 20px; border-radius: 4px; margin-bottom: 32px; }
        .route-block .pickup { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .route-block .dropoff { font-size: 13px; color: #555; }
        .route-block .arrow { color: #b8962e; margin: 4px 0; font-size: 16px; }
        .route-meta { display: flex; gap: 24px; margin-top: 10px; flex-wrap: wrap; }
        .route-meta span { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        thead th { text-align: left; padding: 10px 12px; background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; font-weight: 600; }
        tbody td, tfoot td { padding: 12px; font-size: 14px; color: #333; border-bottom: 1px solid #f0f0f0; }
        .amount-col { text-align: right; font-variant-numeric: tabular-nums; }
        .subtotal-row td { color: #555; }
        .total-row td { font-weight: 700; font-size: 16px; color: #111; border-top: 2px solid #111; border-bottom: none; padding-top: 16px; }
        .payment-status { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-top: 8px; }
        .status-paid { background: #d1fae5; color: #065f46; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .footer p { font-size: 11px; color: #999; }
        .print-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: #b8962e; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .warn { background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; padding: 12px 16px; border-radius: 6px; font-size: 12px; margin-bottom: 24px; line-height: 1.6; }
        @media print { .no-print { display: none !important; } .page { padding: 20px; } }
      `}</style>

      <div className="page">
        <div className="no-print" style={{ marginBottom: 24, display: "flex", justifyContent: "flex-end" }}>
          <form action="" method="dialog">
            <button className="print-btn" formTarget="_self" onClick={undefined} type="button" id="printBtn">
              Print / Save as PDF
            </button>
          </form>
          <script
            dangerouslySetInnerHTML={{
              __html: `document.getElementById('printBtn').addEventListener('click',function(){window.print();});`,
            }}
          />
        </div>

        {/* An invoice without the issuer's tax number is not a valid Spanish
            invoice. Say so on the document rather than presenting it as final. */}
        {isVat && !isIssuerComplete(issuer) && (
          <p className="warn no-print">
            <strong>Not yet valid for tax purposes.</strong> This invoice is missing:{" "}
            {missingIssuerFields(issuer).join(", ")}. Everything else on it is correct.
          </p>
        )}

        <div className="header">
          <div>
            <div className="logo-mark"><div className="logo-dot" /></div>
            <div className="logo-text">ÉLITE<span className="gold">BCN</span></div>
            <div className="issuer">
              {/*
                The operator here is a sole trader, so the "company" tax number
                and registered address are one person's private details.
                They are legally required on a VAT invoice and on nothing else,
                so they appear only when an invoice has actually been issued.

                A payment receipt shows the trading name and the contact inbox —
                everything the customer needs to identify who charged them, and
                nothing more. Printing a private NIF and home address on every
                receipt discloses them to every customer who ever books.
              */}
              {isVat ? (
                <>
                  <div><strong style={{ color: "#333" }}>{issuer.legalName}</strong></div>
                  {issuer.tradeName && <div>Trading as {issuer.tradeName}</div>}
                  {issuer.taxId   && <div>NIF: {issuer.taxId}</div>}
                  {issuer.address && <div>{issuer.address}</div>}
                </>
              ) : (
                <div>
                  <strong style={{ color: "#333" }}>{issuer.tradeName ?? "Élite BCN Transfers"}</strong>
                  {" · Luxury Private Transfers, Barcelona"}
                </div>
              )}
              <div>{COMPANY.email}</div>
            </div>
          </div>
          <div className="invoice-meta">
            <h1>{docTitle}</h1>
            <p className="code">{docRef}</p>
            <p className="date">Issued {issuedDate}</p>
            <span className={`payment-status ${booking.paymentStatus === "PAID" ? "status-paid" : "status-pending"}`}>
              {booking.paymentStatus === "PAID" ? "PAID" : "PAYMENT PENDING"}
            </span>
          </div>
        </div>

        <div className="grid2">
          <div className="info-block">
            <p className="section-title">Billed To</p>
            <p><strong>{invoice?.customerName ?? booking.guestName ?? "Guest"}</strong></p>
            {invoice?.customerTaxId   && <p>NIF/VAT: {invoice.customerTaxId}</p>}
            {invoice?.customerAddress && <p>{invoice.customerAddress}</p>}
            {booking.guestEmail && <p>{booking.guestEmail}</p>}
            {booking.guestPhone && <p>{booking.guestPhone}</p>}
          </div>
          <div className="info-block">
            <p className="section-title">Transfer Details</p>
            <p><strong>{vehicleLabel[booking.vehicleClass] ?? booking.vehicleClass}</strong></p>
            <p>
              {booking.passengers} passenger{booking.passengers !== 1 ? "s" : ""}
              {booking.luggage > 0 ? `, ${booking.luggage} bag${booking.luggage !== 1 ? "s" : ""}` : ""}
            </p>
            <p>{dateStr}</p>
            {booking.flightNumber && <p>Flight {booking.flightNumber}</p>}
          </div>
        </div>

        <div className="route-block">
          <p className="section-title">Route</p>
          <p className="pickup">{booking.pickupAddress}</p>
          <p className="arrow">↓</p>
          <p className="dropoff">{booking.dropoffAddress}</p>
          {(booking.distanceKm > 0 || booking.durationMin > 0) && (
            <div className="route-meta">
              {booking.distanceKm  > 0 && <span>~{booking.distanceKm.toFixed(1)} km</span>}
              {booking.durationMin > 0 && <span>~{Math.round(booking.durationMin)} min</span>}
            </div>
          )}
        </div>

        <table>
          <thead>
            <tr><th>Description</th><th className="amount-col">Amount</th></tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td className="amount-col">{fmt(item.amount)}</td>
              </tr>
            ))}
            {booking.specialRequests && (
              <tr>
                <td colSpan={2} style={{ fontSize: 12, color: "#888", fontStyle: "italic" }}>
                  Note: {booking.specialRequests}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            {isVat ? (
              <>
                <tr className="subtotal-row">
                  <td>Subtotal (excl. VAT)</td>
                  <td className="amount-col">{fmt(totals.net)}</td>
                </tr>
                <tr className="subtotal-row">
                  <td>VAT at {totals.rate}%</td>
                  <td className="amount-col">{fmt(totals.vat)}</td>
                </tr>
                <tr className="total-row">
                  <td>Total due</td>
                  <td className="amount-col">{fmt(totals.gross)}</td>
                </tr>
              </>
            ) : (
              <tr className="total-row">
                <td>Total paid</td>
                <td className="amount-col">{fmt(booking.totalAmount)}</td>
              </tr>
            )}
          </tfoot>
        </table>

        {!isVat && (
          <p style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>
            This is a payment receipt. The fare excludes VAT and motorway tolls. If you need a
            VAT invoice, request one from your bookings page and 10% VAT will be added.
          </p>
        )}

        <div className="footer">
          <div>
            <p>Thank you for choosing Élite BCN Transfers.</p>
            <p>Questions? Contact {COMPANY.email}</p>
          </div>
          <p>Booking #{booking.confirmationCode.slice(0, 12).toUpperCase()}</p>
        </div>
      </div>
    </>
  );
}
