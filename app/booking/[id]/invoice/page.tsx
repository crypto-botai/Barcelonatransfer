import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      confirmationCode: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      pickupAddress: true,
      dropoffAddress: true,
      pickupDatetime: true,
      passengers: true,
      luggage: true,
      vehicleClass: true,
      flightNumber: true,
      specialRequests: true,
      baseFare: true,
      distanceFare: true,
      airportSurcharge: true,
      nightSurcharge: true,
      totalAmount: true,
      currency: true,
      status: true,
      paymentStatus: true,
      distanceKm: true,
      durationMin: true,
      createdAt: true,
    },
  });

  if (!booking) notFound();

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: booking.currency }).format(n);

  const dateStr = new Date(booking.pickupDatetime).toLocaleString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const issuedDate = new Date(booking.createdAt).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const vehicleLabel: Record<string, string> = {
    BUSINESS:  "Business Class",
    FIRST:     "First Class",
    VAN:       "Executive Van",
    MINIBUS:   "Minibus",
    ELECTRIC:  "Electric Premium",
  };

  const lineItems = [
    { label: "Base fare",            amount: booking.baseFare },
    { label: "Distance fare",        amount: booking.distanceFare,     show: booking.distanceFare > 0 },
    { label: "Airport surcharge",    amount: booking.airportSurcharge,  show: booking.airportSurcharge > 0 },
    { label: "Night/early surcharge",amount: booking.nightSurcharge,    show: booking.nightSurcharge > 0 },
  ].filter((i) => i.show !== false);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #fff; color: #111; }
        .page { max-width: 760px; margin: 0 auto; padding: 48px 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #b8962e; padding-bottom: 24px; }
        .logo-mark { width: 32px; height: 32px; border: 2px solid #b8962e; transform: rotate(45deg); display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
        .logo-dot { width: 10px; height: 10px; background: #b8962e; }
        .logo-text { font-size: 22px; font-weight: 700; letter-spacing: 0.15em; }
        .logo-text .gold { color: #b8962e; }
        .invoice-meta { text-align: right; }
        .invoice-meta h1 { font-size: 28px; font-weight: 700; letter-spacing: 0.05em; color: #111; }
        .invoice-meta .code { font-size: 13px; color: #666; margin-top: 4px; font-family: monospace; }
        .invoice-meta .date { font-size: 12px; color: #888; margin-top: 2px; }
        .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #888; font-weight: 600; margin-bottom: 8px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
        .info-block p { font-size: 14px; line-height: 1.7; color: #333; }
        .info-block strong { color: #111; }
        .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
        .route-block { background: #f9f7f0; border-left: 3px solid #b8962e; padding: 16px 20px; border-radius: 4px; margin-bottom: 32px; }
        .route-block .pickup { font-size: 14px; font-weight: 600; color: #111; margin-bottom: 4px; }
        .route-block .dropoff { font-size: 13px; color: #555; }
        .route-block .arrow { color: #b8962e; margin: 4px 0; font-size: 16px; }
        .route-meta { display: flex; gap: 24px; margin-top: 10px; flex-wrap: wrap; }
        .route-meta span { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        thead th { text-align: left; padding: 10px 12px; background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; font-weight: 600; }
        tbody td { padding: 12px; font-size: 14px; color: #333; border-bottom: 1px solid #f0f0f0; }
        .amount-col { text-align: right; }
        .total-row td { font-weight: 700; font-size: 16px; color: #111; border-top: 2px solid #111; border-bottom: none; padding-top: 16px; }
        .payment-status { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .status-paid { background: #d1fae5; color: #065f46; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .footer p { font-size: 11px; color: #999; }
        .print-btn { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: #b8962e; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 24px; }
        .no-print { display: block; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
          .page { padding: 20px; }
        }
      `}</style>

      <div className="page">
        {/* Print button — hidden when printing */}
        <div className="no-print" style={{ marginBottom: "24px", display: "flex", justifyContent: "flex-end" }}>
          <button className="print-btn" onClick={undefined}>
            🖨️ Print / Save as PDF
          </button>
          <script dangerouslySetInnerHTML={{ __html: "document.querySelector('.print-btn').onclick = () => window.print();" }} />
        </div>

        {/* Header */}
        <div className="header">
          <div>
            <div className="logo-mark">
              <div className="logo-dot" />
            </div>
            <div className="logo-text">
              ÉLITE<span className="gold">BCN</span>
            </div>
            <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Luxury Private Transfers · Barcelona</p>
            <p style={{ fontSize: 11, color: "#888" }}>vtcbcn2025@gmail.com</p>
          </div>
          <div className="invoice-meta">
            <h1>RECEIPT</h1>
            <p className="code">#{booking.confirmationCode.slice(0, 12).toUpperCase()}</p>
            <p className="date">Issued {issuedDate}</p>
            <span
              className={`payment-status ${booking.paymentStatus === "PAID" ? "status-paid" : "status-pending"}`}
              style={{ marginTop: 8, display: "inline-block" }}
            >
              {booking.paymentStatus === "PAID" ? "PAID" : "PAYMENT PENDING"}
            </span>
          </div>
        </div>

        {/* Customer info */}
        <div className="grid2">
          <div className="info-block">
            <p className="section-title">Billed To</p>
            <p><strong>{booking.guestName ?? "Guest"}</strong></p>
            {booking.guestEmail && <p>{booking.guestEmail}</p>}
            {booking.guestPhone && <p>{booking.guestPhone}</p>}
          </div>
          <div className="info-block">
            <p className="section-title">Transfer Details</p>
            <p><strong>{vehicleLabel[booking.vehicleClass] ?? booking.vehicleClass}</strong></p>
            <p>{booking.passengers} passenger{booking.passengers !== 1 ? "s" : ""}{booking.luggage > 0 ? `, ${booking.luggage} bag${booking.luggage !== 1 ? "s" : ""}` : ""}</p>
            <p>📅 {dateStr}</p>
            {booking.flightNumber && <p>✈️ Flight {booking.flightNumber}</p>}
          </div>
        </div>

        {/* Route */}
        <div className="route-block">
          <p className="section-title">Route</p>
          <p className="pickup">📍 {booking.pickupAddress}</p>
          <p className="arrow">↓</p>
          <p className="dropoff">🏁 {booking.dropoffAddress}</p>
          {(booking.distanceKm > 0 || booking.durationMin > 0) && (
            <div className="route-meta">
              {booking.distanceKm > 0 && <span>~{booking.distanceKm.toFixed(1)} km</span>}
              {booking.durationMin > 0 && <span>~{Math.round(booking.durationMin)} min</span>}
            </div>
          )}
        </div>

        {/* Line items */}
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="amount-col">Amount</th>
            </tr>
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
            <tr className="total-row">
              <td>Total</td>
              <td className="amount-col">{fmt(booking.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Footer */}
        <div className="footer">
          <div>
            <p>Thank you for choosing Élite BCN Transfers.</p>
            <p>For any questions, contact us at vtcbcn2025@gmail.com</p>
          </div>
          <p>Booking #{booking.confirmationCode.slice(0, 12).toUpperCase()}</p>
        </div>
      </div>
    </>
  );
}
