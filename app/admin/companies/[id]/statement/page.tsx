import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { buildStatement } from "@/lib/corporate";
import { getIssuer } from "@/lib/invoices";

export const dynamic = "force-dynamic";

/**
 * A company's monthly statement.
 *
 * Prints cleanly — this is the document that gets emailed to a finance team, so
 * the on-screen controls are hidden from print and the layout is white-on-black
 * rather than the site's dark theme.
 *
 * Defaults to last month, because a statement is normally issued once the month
 * has closed. ?y= and ?m= override it.
 */
export default async function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/auth/login");

  const { id } = await params;
  const { y, m } = await searchParams;

  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year  = Number(y) || prev.getUTCFullYear();
  const month = Number(m) || prev.getUTCMonth() + 1;

  const statement = await buildStatement(id, year, month);
  if (!statement) notFound();

  const issuer = getIssuer();
  const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
  const periodLabel = new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <style>{`
        .stmt { background:#fff; color:#111; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
        .stmt .sheet { max-width: 900px; margin: 0 auto; padding: 40px; }
        .stmt h1 { font-size: 24px; font-weight: 700; margin: 0; }
        .stmt .muted { color:#777; font-size: 12px; }
        .stmt .head { display:flex; justify-content:space-between; align-items:flex-start; gap:24px;
                      border-bottom:2px solid #b8962e; padding-bottom:20px; margin-bottom:28px; }
        .stmt table { width:100%; border-collapse:collapse; margin-bottom:28px; }
        .stmt th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.08em;
                   color:#666; background:#f3f4f6; padding:9px 10px; font-weight:700; }
        .stmt td { padding:9px 10px; font-size:13px; border-bottom:1px solid #f0f0f0; }
        .stmt .num { text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; }
        .stmt tfoot td { font-weight:700; border-top:2px solid #111; border-bottom:none; padding-top:12px; }
        .stmt .sub td { color:#555; font-weight:400; border:none; padding-top:4px; padding-bottom:4px; }
        .stmt .split { background:#f9f7f0; border-left:3px solid #b8962e; padding:16px 20px; margin-bottom:28px; }
        .stmt .empty { text-align:center; padding:48px 20px; color:#777; }
        .stmt .btn { padding:9px 18px; background:#b8962e; color:#fff; border:0; border-radius:6px;
                     font-size:13px; font-weight:600; cursor:pointer; }
        @media print { .no-print { display:none !important; } .stmt .sheet { padding:0; } }
      `}</style>

      <div className="stmt">
        <div className="sheet">
          <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <button className="btn" type="button" id="printStmt">Print / Save as PDF</button>
            <script dangerouslySetInnerHTML={{ __html: `document.getElementById('printStmt').addEventListener('click',function(){window.print();});` }} />
          </div>

          <div className="head">
            <div>
              <h1>Statement</h1>
              <p className="muted" style={{ marginTop: 4 }}>{periodLabel}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontWeight: 700 }}>{statement.companyName}</p>
              <p className="muted" style={{ marginTop: 4 }}>
                From {issuer.legalName}
                {issuer.taxId ? ` · NIF ${issuer.taxId}` : ""}
              </p>
              <p className="muted">{issuer.email}</p>
            </div>
          </div>

          {statement.lines.length === 0 ? (
            <p className="empty">No completed, paid journeys in {periodLabel}.</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Ref</th><th>Traveller</th><th>Journey</th>
                    <th>Cost centre</th><th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.lines.map((l) => (
                    <tr key={l.bookingId}>
                      <td className="muted">{l.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                      <td style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>{l.code}</td>
                      <td>{l.traveller}</td>
                      <td style={{ fontSize: 12 }}>{l.route}</td>
                      <td className="muted">{l.costCentre ?? "—"}</td>
                      <td className="num">{eur(l.net)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="sub"><td colSpan={5}>Subtotal (excl. VAT)</td><td className="num">{eur(statement.net)}</td></tr>
                  <tr className="sub"><td colSpan={5}>VAT at 10%</td><td className="num">{eur(statement.vat)}</td></tr>
                  <tr><td colSpan={5}>Total due</td><td className="num">{eur(statement.gross)}</td></tr>
                </tfoot>
              </table>

              <div className="split">
                <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: "#888", fontWeight: 700, marginBottom: 10 }}>
                  Split by cost centre
                </p>
                <table style={{ marginBottom: 0 }}>
                  <tbody>
                    {statement.byCostCentre.map((c) => (
                      <tr key={c.code}>
                        <td style={{ border: 0 }}>{c.label}{c.code !== "—" ? ` (${c.code})` : ""}</td>
                        <td className="muted" style={{ border: 0 }}>{c.journeys} journey{c.journeys === 1 ? "" : "s"}</td>
                        <td className="num" style={{ border: 0 }}>{eur(c.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="muted">
            Fares exclude motorway tolls, which are charged separately where a route uses them.
            {!issuer.taxId && " This statement is missing the issuing company's NIF/CIF and is not yet valid for tax purposes."}
          </p>
        </div>
      </div>
    </>
  );
}
