import { COMPANY } from "@/lib/company-facts";

/**
 * Transactional email templates.
 *
 * Every builder returns a self-contained <table>. `emailDocument` wraps one in
 * a full HTML document for sending; the preview page renders the bare table
 * directly, so the two can never drift apart.
 *
 * Rules that keep these rendering correctly in Outlook, Gmail and Apple Mail:
 * tables for all layout, styles inline, no flexbox, no grid, no web fonts,
 * no background-image. Gmail strips <head><style>, so nothing may depend on it.
 *
 * The wordmark is deliberately plain ASCII "ELITE" rather than "ÉLITE" — an
 * accented character in a From header has to survive every mail gateway in the
 * chain and repeatedly arrived as "?lite".
 */

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";
const PHONE = "+34 635 383 712";
const PHONE_DIGITS = "34635383712";

// ─── Palette ─────────────────────────────────────────────────
const BG = "#202329";      // body ground — charcoal
const PANEL = "#262A31";   // raised panel on the body
const BAND = "#F0EFEC";    // header / footer / button — bone
const TITLE = "#FFFFFF";   // headlines
const TEXT = "#ADADB4";    // paragraphs
const LABEL = "#8E8E96";   // small caps labels
const RULE = "#35383F";    // hairlines on dark
const GOLD = "#B68D4C";    // the single accent
const GOLD_DEEP = "#A07E43"; // gold on light bands (contrast)
const GOLD_EDGE = "#6E5A30"; // gold border on dark
const BAND_INK = "#1A1A1E";  // wordmark on light band
const BAND_MUTED = "#6A6A70"; // muted text on light band
const SERIF = "Georgia,'Times New Roman',Times,serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function esc(s: string | number | undefined | null): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Building blocks ─────────────────────────────────────────

function eyebrow(text: string): string {
  return `<div style="font-family:${SANS};font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:${GOLD};">${esc(text)}</div>`;
}

function headline(text: string): string {
  return `<div style="font-family:${SERIF};font-size:29px;line-height:38px;color:${TITLE};padding-top:14px;font-weight:normal;">${text}</div>`;
}

function paragraph(text: string, top = 16): string {
  return `<div style="font-family:${SANS};font-size:15px;line-height:25px;color:${TEXT};padding-top:${top}px;">${text}</div>`;
}

/**
 * A label/value row. The label sits in its own fixed column with real padding
 * so long values wrap beneath the value, never colliding with the label.
 */
function row(label: string, value: string, last = false): string {
  const border = last ? "none" : `1px solid ${RULE}`;
  return `<tr>
    <td style="padding:15px 18px 15px 0;border-bottom:${border};vertical-align:top;width:118px;">
      <span style="font-family:${SANS};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${LABEL};">${esc(label)}</span>
    </td>
    <td style="padding:15px 0;border-bottom:${border};vertical-align:top;">
      <span style="font-family:${SANS};font-size:15px;line-height:23px;color:${TITLE};">${value}</span>
    </td>
  </tr>`;
}

function detailTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
}

/** Bone-coloured button with gold letterspaced caps. */
function button(href: string, text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
    <tr><td style="background-color:${BAND};">
      <a href="${href}" style="display:inline-block;padding:16px 42px;font-family:${SANS};font-size:12px;letter-spacing:2.5px;text-transform:uppercase;color:${GOLD_DEEP};text-decoration:none;font-weight:bold;">${esc(text)}</a>
    </td></tr>
  </table>`;
}

function secondaryLink(href: string, text: string): string {
  return `<a href="${href}" style="font-family:${SANS};font-size:13px;color:${GOLD};text-decoration:none;border-bottom:1px solid ${GOLD_EDGE};padding-bottom:2px;">${esc(text)}</a>`;
}

/** Gold-bordered reference block. */
function referencePanel(code: string, caption?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};border:1px solid ${GOLD_EDGE};">
    <tr><td style="padding:26px 28px;text-align:center;">
      <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${LABEL};">Reference</div>
      <div style="font-family:${SERIF};font-size:29px;letter-spacing:7px;color:${GOLD};padding-top:12px;">${esc(code)}</div>
      ${caption ? `<div style="font-family:${SANS};font-size:12px;line-height:18px;color:${LABEL};padding-top:12px;">${esc(caption)}</div>` : ""}
    </td></tr>
  </table>`;
}

/** Bone amount bar — label left, gold figure right. */
function amountBar(label: string, amount: number, note?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BAND};">
    <tr>
      <td style="padding:22px 26px;vertical-align:middle;">
        <span style="font-family:${SANS};font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${BAND_MUTED};">${esc(label)}</span>
      </td>
      <td style="padding:22px 26px;text-align:right;vertical-align:middle;">
        <span style="font-family:${SERIF};font-size:26px;color:${GOLD_DEEP};">&euro;${amount.toFixed(2)}</span>
        ${note ? `<div style="font-family:${SANS};font-size:11px;color:${BAND_MUTED};padding-top:3px;">${note}</div>` : ""}
      </td>
    </tr>
  </table>`;
}

/**
 * How the price is settled, when it is not simply "paid in full".
 *
 * A deposit booking says what was paid today and what the chauffeur collects
 * on the day; a protected booking says so and what that buys. Empty for the
 * ordinary case, so every card can include it unconditionally.
 */
export interface PaymentSplit {
  /** Charged online today (or due online, when `paid` is false). */
  payNow: number;
  /** To the chauffeur on the day. 0 on a full payment. */
  balance: number;
  /** Cancellation protection fee, 0 when not taken. */
  protectionFee: number;
  /** Whether payNow has actually been received. */
  paid: boolean;
  /** A line under the split, e.g. how a round trip divides the balance. */
  note?: string;
}

function splitPanel(o?: PaymentSplit | null): string {
  if (!o || (o.balance <= 0 && o.protectionFee <= 0)) return "";
  const lines: string[] = [];
  if (o.balance > 0) {
    lines.push(row(o.paid ? "Paid today" : "Due today", `&euro;${o.payNow.toFixed(2)}`));
    lines.push(row("To your chauffeur", `<strong style="font-weight:bold;">&euro;${o.balance.toFixed(2)}</strong> <span style="color:${LABEL};">on the day, cash or card</span>`, o.protectionFee <= 0));
  }
  if (o.protectionFee > 0) {
    lines.push(row("Protection", `Included (&euro;${o.protectionFee.toFixed(2)}) &mdash; cancel up to 2 hours before pick-up for a full refund of the fare`, true));
  }
  return `
    ${sectionSpacer(12)}
    <tr><td style="padding:0 44px;">${detailTable(lines.join(""))}</td></tr>${o.note ? `
    <tr><td style="padding:10px 44px 0 44px;"><div style="font-family:${SANS};font-size:12px;line-height:19px;color:${LABEL};">${esc(o.note)}</div></td></tr>` : ""}`;
}

/**
 * The policy panel: the five lines a customer agreed to at the checkout,
 * repeated in their confirmation so the email and the page cannot differ.
 * Text comes from lib/policies.ts.
 */
/**
 * Where to go and what to do on arrival.
 *
 * Set apart from the policy panel below it, and above it in the email,
 * because it is the part a customer opens the email at the airport to find.
 */
function arrivalPanel(o?: { heading: string; points: string[] } | null): string {
  if (!o || !o.points.length) return "";
  const rows = o.points.map((p) => `<tr><td style="padding:0 0 10px 0;vertical-align:top;"><span style="color:${GOLD};padding-right:8px;">&bull;</span></td><td style="padding:0 0 10px 0;font-family:${SANS};font-size:13px;line-height:20px;color:${TEXT};">${esc(p)}</td></tr>`).join("");
  return `
    ${sectionSpacer(18)}
    <tr><td style="padding:0 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};border:1px solid ${GOLD_EDGE};">
        <tr><td style="padding:22px 26px;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${LABEL};padding-bottom:12px;">${esc(o.heading)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
        </td></tr>
      </table>
    </td></tr>`;
}

function policyPanel(points: string[], policyUrl: string): string {
  if (!points.length) return "";
  const rows = points.map((p) => `<tr><td style="padding:0 0 10px 0;vertical-align:top;"><span style="color:${GOLD};padding-right:8px;">&bull;</span></td><td style="padding:0 0 10px 0;font-family:${SANS};font-size:13px;line-height:20px;color:${TEXT};">${esc(p)}</td></tr>`).join("");
  return `
    ${sectionSpacer(18)}
    <tr><td style="padding:0 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};border:1px solid ${GOLD_EDGE};">
        <tr><td style="padding:22px 26px;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${LABEL};padding-bottom:12px;">Good to know</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
          <div style="font-family:${SANS};font-size:12px;line-height:19px;color:${LABEL};padding-top:6px;">Full detail: <a href="${policyUrl}" style="color:${GOLD};text-decoration:none;">refund and cancellation policy</a>.</div>
        </td></tr>
      </table>
    </td></tr>`;
}

/** The line a chauffeur or fleet company reads about money on the day. */
function collectPanel(amount?: number | null): string {
  if (!amount || amount <= 0) return "";
  return `
    ${sectionSpacer(18)}
    <tr><td style="padding:0 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};border:1px solid ${GOLD_EDGE};">
        <tr><td style="padding:20px 24px;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${LABEL};">Collect from the client</div>
          <div style="font-family:${SERIF};font-size:24px;color:${GOLD};padding-top:8px;">&euro;${amount.toFixed(2)}</div>
          <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${TEXT};padding-top:6px;">Cash or card, at the end of the journey. Mark it received when you finish the ride.</div>
        </td></tr>
      </table>
    </td></tr>`;
}

function sectionSpacer(height = 32): string {
  return `<tr><td style="height:${height}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
}

// ─── Shell ───────────────────────────────────────────────────

function card(content: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#15171B;">
  <tr><td align="center" style="padding:32px 12px;">

    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${BG};">

      <!-- masthead band -->
      <tr><td style="background-color:${BAND};padding:34px 40px 30px 40px;text-align:center;">
        <div style="font-family:${SERIF};font-size:27px;letter-spacing:10px;color:${BAND_INK};">ELITE<span style="color:${GOLD_DEEP};">BCN</span></div>
        <div style="font-family:${SANS};font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${BAND_MUTED};padding-top:11px;">Luxury Transfers &middot; Barcelona</div>
      </td></tr>
      <tr><td style="height:2px;background-color:${GOLD_DEEP};font-size:0;line-height:0;">&nbsp;</td></tr>

      ${content}

      <!-- footer band -->
      <tr><td style="background-color:${BAND};padding:32px 40px;text-align:center;">
        <div style="font-family:${SERIF};font-size:16px;letter-spacing:6px;color:${BAND_INK};">ELITE<span style="color:${GOLD_DEEP};">BCN</span></div>
        <div style="font-family:${SANS};font-size:12px;line-height:21px;color:${BAND_MUTED};padding-top:14px;">
          <a href="tel:${PHONE_DIGITS}" style="color:${BAND_MUTED};text-decoration:none;">${PHONE}</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:${COMPANY.email}" style="color:${BAND_MUTED};text-decoration:none;">${COMPANY.email}</a>
        </div>
        <div style="font-family:${SANS};font-size:11px;line-height:19px;color:#8C8C92;padding-top:10px;">
          Barcelona, Spain &middot; Licensed VTC Operator<br>
          &copy; ${new Date().getFullYear()} Elite BCN Transfers &middot;
          <a href="${SITE_URL}/privacy" style="color:#8C8C92;">Privacy</a> &middot;
          <a href="${SITE_URL}/terms" style="color:#8C8C92;">Terms</a>
        </div>
      </td></tr>

    </table>

  </td></tr>
</table>`;
}

/** Wraps a card in a sendable HTML document. */
export function emailDocument(inner: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/>
<meta name="color-scheme" content="dark"/>
<meta name="supported-color-schemes" content="dark"/>
<title>Elite BCN</title>
</head>
<body style="margin:0;padding:0;background-color:#15171B;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;font-size:0;line-height:0;max-height:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>
${inner}
</body>
</html>`;
}

// ─── 1. Booking received (customer) ──────────────────────────

export function bookingReceivedCard(o: {
  firstName: string; confirmationCode: string;
  pickupAddress: string; dropoffAddress: string;
  date: string; time: string; vehicle: string;
  passengers: number; totalAmount: number;
  /**
   * How the fare is settled, for bookings the office makes by hand. A website
   * booking is paid at checkout and says nothing here. `line` is the sentence
   * the customer reads; `payUrl` adds a pay-by-card button under it.
   */
  payment?: { line: string; payUrl?: string; paid?: boolean };
  /** Deposit / protection breakdown; omitted on an ordinary full payment. */
  split?: PaymentSplit | null;
  /** The checkout policy lines, repeated here. */
  policy?: { points: string[]; url: string } | null;
  /** Where to go on the day. */
  arrival?: { heading: string; points: string[] } | null;
  /** Add-to-calendar links: Google, and an .ics for Apple and Outlook. */
  calendar?: { google: string; ics: string };
  /** The reverse journey, pre-filled, offered when this is a one-way booking. */
  returnUrl?: string | null;
  /**
   * The leg home, on a round trip.
   *
   * It has a booking and a reference of its own — it is driven separately and
   * may have a different chauffeur — so both are named here. A customer who
   * paid for two journeys and was sent confirmation of one would reasonably
   * assume the return had not been booked.
   */
  returnLeg?: {
    confirmationCode: string;
    date: string; time: string;
    pickupAddress: string; dropoffAddress: string;
    totalAmount: number;
  };
}): string {
  const wa = `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(`Hello, my booking reference is ${o.confirmationCode}`)}`;
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Booking Received")}
      ${headline(`Thank you, ${esc(o.firstName)}.`)}
      ${paragraph("Your transfer is reserved. Our team is confirming the details and your chauffeur will be assigned shortly.")}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">${referencePanel(o.confirmationCode, "Quote this reference in any correspondence")}</td></tr>
    ${sectionSpacer(12)}

    <tr><td style="padding:0 44px;">
      ${detailTable(
        (o.returnLeg ? row("Journey", "Outbound") : "") +
        row("Pick-up", esc(o.pickupAddress)) +
        row("Drop-off", esc(o.dropoffAddress)) +
        row("Date", `${esc(o.date)}${o.time ? ` &nbsp;&middot;&nbsp; ${esc(o.time)}` : ""}`) +
        row("Vehicle", esc(o.vehicle)) +
        row("Guests", String(o.passengers), true),
      )}
    </td></tr>

    ${o.returnLeg ? `
      ${sectionSpacer(18)}
      <tr><td style="padding:0 44px;">
        ${detailTable(
          row("Journey", "Return") +
          row("Reference", esc(o.returnLeg.confirmationCode)) +
          row("Pick-up", esc(o.returnLeg.pickupAddress)) +
          row("Drop-off", esc(o.returnLeg.dropoffAddress)) +
          row("Date", `${esc(o.returnLeg.date)}${o.returnLeg.time ? ` &nbsp;&middot;&nbsp; ${esc(o.returnLeg.time)}` : ""}`) +
          row("Vehicle", esc(o.vehicle), true),
        )}
      </td></tr>
    ` : ""}

    ${sectionSpacer(28)}
    <tr><td style="padding:0 44px;">${amountBar(
      o.returnLeg ? "Total, both journeys" : "Total",
      o.totalAmount,
      o.payment?.paid ? "paid, thank you" : "excl. VAT &amp; tolls",
    )}</td></tr>
    ${splitPanel(o.split)}
    ${arrivalPanel(o.arrival)}
    ${o.policy ? policyPanel(o.policy.points, o.policy.url) : ""}

    ${o.payment ? `
      ${sectionSpacer(18)}
      <tr><td style="padding:0 44px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};border:1px solid ${GOLD_EDGE};">
          <tr><td style="padding:20px 24px;${o.payment.payUrl ? "text-align:center;" : ""}">
            <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${LABEL};">Payment</div>
            <div style="font-family:${SANS};font-size:14px;line-height:22px;color:${TITLE};padding-top:8px;">${esc(o.payment.line)}</div>
            ${o.payment.payUrl ? `<div style="padding-top:16px;">${button(o.payment.payUrl, "Pay by Card")}</div>` : ""}
          </td></tr>
        </table>
      </td></tr>
    ` : ""}
    ${o.calendar ? `
      ${sectionSpacer(18)}
      <tr><td style="padding:0 44px;text-align:center;">
        <div style="font-family:${SANS};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${LABEL};">Add to your calendar</div>
        <div style="font-family:${SANS};font-size:14px;padding-top:8px;">
          <a href="${o.calendar.google}" style="color:${GOLD};text-decoration:none;">Google Calendar</a>
          <span style="color:${LABEL};">&nbsp;&middot;&nbsp;</span>
          <a href="${o.calendar.ics}" style="color:${GOLD};text-decoration:none;">Apple / Outlook (.ics)</a>
        </div>
      </td></tr>
    ` : ""}

    ${o.returnUrl && !o.returnLeg ? `
      ${sectionSpacer(28)}
      <tr><td style="padding:0 44px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};border:1px solid ${GOLD_EDGE};">
          <tr><td style="padding:22px 26px;">
            <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${LABEL};">Going back too?</div>
            <div style="font-family:${SERIF};font-size:20px;color:${TITLE};padding-top:8px;">Book the return now and save 5%.</div>
            <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${TEXT};padding-top:8px;">The route is already filled in the other way round, and the 5% comes off at the checkout. Choose the date and time and it is done.</div>
            <div style="padding-top:16px;">${secondaryLink(o.returnUrl, "Book my return journey")}</div>
          </td></tr>
        </table>
      </td></tr>
    ` : ""}
    ${sectionSpacer(32)}

    <tr><td style="padding:0 44px;text-align:center;">
      ${button(wa, "Message Our Team")}
      <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${LABEL};padding-top:18px;">
        Need to change something? Reply to this email or call
        <a href="tel:${PHONE_DIGITS}" style="color:${GOLD};text-decoration:none;">${PHONE}</a>.
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 2. New lead (admin) ─────────────────────────────────────

export function newLeadCard(o: {
  name: string; email: string; phone: string;
  pickup?: string | null; dropoff?: string | null;
  when?: string | null; passengers?: number | null;
}): string {
  const wa = `https://wa.me/${o.phone.replace(/\D/g, "")}`;
  const optional =
    (o.pickup ? row("Pick-up", esc(o.pickup)) : "") +
    (o.dropoff ? row("Drop-off", esc(o.dropoff)) : "") +
    (o.when ? row("When", esc(o.when)) : "") +
    (o.passengers ? row("Guests", String(o.passengers)) : "");

  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Admin · Unpaid Enquiry")}
      ${headline("Someone is booking right now.")}
      ${paragraph("They have entered their details but have not paid. Calling within the next few minutes is the best chance of winning this booking.")}
    </td></tr>

    ${sectionSpacer(28)}
    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Name", `<strong style="font-weight:bold;">${esc(o.name)}</strong>`) +
        row("Phone", `<a href="tel:${esc(o.phone)}" style="color:${GOLD};text-decoration:none;">${esc(o.phone)}</a>`) +
        row("Email", `<a href="mailto:${esc(o.email)}" style="color:${GOLD};text-decoration:none;">${esc(o.email)}</a>`) +
        optional +
        row("Status", `<span style="color:${LABEL};">Not paid yet</span>`, true),
      )}
    </td></tr>

    ${sectionSpacer(32)}
    <tr><td style="padding:0 44px;text-align:center;">
      ${button(`tel:${esc(o.phone)}`, "Call The Guest")}
      <div style="padding-top:16px;">${secondaryLink(wa, "Message on WhatsApp")}</div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 3. Ride confirmed (customer) ────────────────────────────

export function rideConfirmedCard(o: {
  firstName: string; confirmationCode: string;
  pickupAddress: string; date: string; time: string; vehicle: string;
  /** Passenger arrival link. Airport pick-ups only; omitted elsewhere. */
  arrivalUrl?: string | null;
}): string {
  const wa = `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(`Hello, my booking reference is ${o.confirmationCode}`)}`;
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Confirmed")}
      ${headline("Your transfer is tomorrow.")}
      ${paragraph(`A short reminder, ${esc(o.firstName)} &mdash; everything is arranged and your chauffeur will be in touch ahead of pick-up.`)}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">${referencePanel(o.confirmationCode)}</td></tr>
    ${sectionSpacer(12)}

    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Pick-up", esc(o.pickupAddress)) +
        row("Date", `${esc(o.date)}${o.time ? ` &nbsp;&middot;&nbsp; ${esc(o.time)}` : ""}`) +
        row("Vehicle", esc(o.vehicle), true),
      )}
    </td></tr>

    ${sectionSpacer(28)}
    <tr><td style="padding:0 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};">
        <tr><td style="padding:24px 26px;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${GOLD};">Before you travel</div>
          <div style="font-family:${SANS};font-size:14px;line-height:24px;color:${TEXT};padding-top:12px;">
            Your chauffeur calls roughly 30 minutes before pick-up.<br>
            <!-- This told every customer their driver waits in the arrivals
                 hall with a name board. That is the Meet &amp; Greet extra; the
                 standard pickup is outside, by the taxi rank. Anyone who had
                 not paid the €5 was being sent to the wrong place by their own
                 confirmation email, with the driver waiting outside. -->
            For airport arrivals, they wait at the meeting point just outside your terminal, beside the taxi rank — or inside the arrivals hall with a name board if you added Meet &amp; Greet.<br>
            Save our number in case plans change.
          </div>
        </td></tr>
      </table>
    </td></tr>

    ${o.arrivalUrl ? `
    ${sectionSpacer(28)}
    <tr><td style="padding:0 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${GOLD_EDGE};">
        <tr><td style="padding:26px 26px 28px 26px;text-align:center;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${GOLD};">On the day</div>
          <div style="font-family:${SERIF};font-size:21px;line-height:29px;color:${TITLE};padding-top:10px;">Tell us when you land</div>
          <div style="font-family:${SANS};font-size:14px;line-height:23px;color:${TEXT};padding-top:12px;">
            One tap at passport control, at the baggage belt and when you set off for
            the meeting point. Your chauffeur sees each one, so nobody has to call
            anybody and the car is there as you arrive.
          </div>
          <div style="padding-top:20px;">${button(o.arrivalUrl, "Open My Arrival Page")}</div>
          <div style="font-family:${SANS};font-size:11px;line-height:18px;color:${LABEL};padding-top:14px;">
            No app, no sign-in, and no location tracking &mdash; only the steps you tap.
          </div>
        </td></tr>
      </table>
    </td></tr>` : ""}

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;text-align:center;">${button(wa, "Contact Us")}</td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 3b. Flight delayed ──────────────────────────────────────

/**
 * The delay, told to whoever needs it.
 *
 * Two audiences, one layout, different endings. The customer is being
 * reassured — there is nothing for them to do and no extra charge. The driver
 * is being given an instruction: be somewhere else, at a different time. The
 * shared shell keeps the facts identical, which matters when the passenger
 * quotes the landing time back to the driver at the barrier.
 */
export function flightDelayCard(o: {
  audience: "customer" | "driver";
  firstName: string;
  flight: string;
  when: string;
  confirmationCode: string;
  delayMinutes?: number | null;
  /** Driver copy only. */
  passenger?: string;
  pickupAddress?: string;
}): string {
  const forDriver = o.audience === "driver";
  const late = o.delayMinutes && o.delayMinutes > 0 ? `${o.delayMinutes} minutes late` : null;

  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow(forDriver ? "Pick-up moved" : "Flight delayed")}
      ${headline(forDriver
        ? `Flight ${esc(o.flight)} is running late.`
        : `Your flight is delayed, ${esc(o.firstName)}.`)}
      ${paragraph(forDriver
        ? "Your passenger will land later than planned. The pick-up moves with the flight — please collect at the new time."
        : "We track your flight, so we already know. Your chauffeur has been given the new time and will be there when you land. There is nothing you need to do, and no extra charge.")}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};border:1px solid ${GOLD_EDGE};">
        <tr><td style="padding:26px 28px;text-align:center;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${LABEL};">New landing time</div>
          <div style="font-family:${SERIF};font-size:27px;color:${GOLD};padding-top:11px;">${esc(o.when)}</div>
          ${late ? `<div style="font-family:${SANS};font-size:12px;color:${LABEL};padding-top:9px;">${esc(late)}</div>` : ""}
        </td></tr>
      </table>
    </td></tr>
    ${sectionSpacer(12)}

    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Flight", esc(o.flight)) +
        (forDriver && o.passenger ? row("Passenger", esc(o.passenger)) : "") +
        (forDriver && o.pickupAddress ? row("Pick-up", esc(o.pickupAddress)) : "") +
        row("Reference", `<span style="letter-spacing:2px;color:${GOLD};">${esc(o.confirmationCode)}</span>`, true),
      )}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;text-align:center;">
      <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${LABEL};">
        ${forDriver
          ? "If this clashes with another job, tell dispatch now so it can be re-planned."
          : `Anything changed at your end? Reply to this email or call <a href="tel:${PHONE_DIGITS}" style="color:${GOLD};text-decoration:none;">${PHONE}</a>.`}
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 4. Driver assigned (customer) ───────────────────────────

export function driverAssignedCard(o: {
  firstName: string; confirmationCode: string;
  driverName: string; driverPhone: string;
  vehicle: string; licensePlate: string; pickupDatetime: string;
}): string {
  const waDriver = `https://wa.me/${o.driverPhone.replace(/\D/g, "")}`;
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Chauffeur Assigned")}
      ${headline(`Your chauffeur is confirmed, ${esc(o.firstName)}.`)}
      ${paragraph("You can reach them directly at any time before your journey.")}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};border:1px solid ${GOLD_EDGE};">
        <tr><td style="padding:28px;text-align:center;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${LABEL};">Your chauffeur</div>
          <div style="font-family:${SERIF};font-size:27px;color:${TITLE};padding-top:10px;">${esc(o.driverName)}</div>
          <div style="font-family:${SANS};font-size:15px;padding-top:10px;">
            <a href="tel:${esc(o.driverPhone)}" style="color:${GOLD};text-decoration:none;">${esc(o.driverPhone)}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
    ${sectionSpacer(12)}

    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Vehicle", esc(o.vehicle)) +
        row("Plate", `<span style="letter-spacing:1.5px;">${esc(o.licensePlate)}</span>`) +
        row("Pick-up", esc(o.pickupDatetime)) +
        row("Reference", `<span style="letter-spacing:2px;color:${GOLD};">${esc(o.confirmationCode)}</span>`, true),
      )}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;text-align:center;">
      ${button(`tel:${esc(o.driverPhone)}`, "Call Chauffeur")}
      <div style="padding-top:16px;">${secondaryLink(waDriver, "Message on WhatsApp")}</div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 5. Payment receipt (customer) ───────────────────────────

export function paymentReceiptCard(o: {
  firstName: string; confirmationCode: string;
  pickupAddress: string; dropoffAddress: string;
  date: string; time: string; vehicle: string;
  passengers: number; totalAmount: number;
  /** Deposit / protection breakdown; omitted on an ordinary full payment. */
  split?: PaymentSplit | null;
  /** The checkout policy lines, repeated here. */
  policy?: { points: string[]; url: string } | null;
  /** Where to go on the day; the part they open this email at the airport for. */
  arrival?: { heading: string; points: string[] } | null;
}): string {
  const deposit = !!o.split && o.split.balance > 0;
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Booking Confirmed")}
      ${headline(`Your transfer is confirmed, ${esc(o.firstName)}.`)}
      ${paragraph(deposit
        ? "Your deposit is received and this email is your receipt. The rest is paid to your chauffeur on the day, in cash or by card. Your chauffeur will be assigned shortly and you will hear from us again the day before you travel."
        : "Paid in full, and this email is your receipt. Your chauffeur will be assigned shortly and you will hear from us again the day before you travel.")}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">${amountBar(deposit ? "Deposit Paid" : "Amount Paid", deposit ? o.split!.payNow : o.totalAmount, deposit ? `of &euro;${o.totalAmount.toFixed(2)} in total` : undefined)}</td></tr>
    ${splitPanel(o.split)}
    ${arrivalPanel(o.arrival)}
    ${o.policy ? policyPanel(o.policy.points, o.policy.url) : ""}
    ${sectionSpacer(12)}

    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Reference", `<span style="letter-spacing:2px;color:${GOLD};">${esc(o.confirmationCode)}</span>`) +
        row("Pick-up", esc(o.pickupAddress)) +
        row("Drop-off", esc(o.dropoffAddress)) +
        row("Date", `${esc(o.date)}${o.time ? ` &nbsp;&middot;&nbsp; ${esc(o.time)}` : ""}`) +
        row("Vehicle", esc(o.vehicle)) +
        row("Guests", String(o.passengers), true),
      )}
    </td></tr>

    ${sectionSpacer(28)}
    <tr><td style="padding:0 44px;text-align:center;">
      <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${LABEL};">
        A VAT invoice is available on request &mdash; simply reply to this email.
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 6. Ride complete (customer) ─────────────────────────────

export function rideCompleteCard(o: {
  firstName: string; confirmationCode: string; reviewUrl: string;
  /** The direct Google review link, for the public word that helps most. */
  googleUrl?: string | null;
}): string {
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Journey Complete")}
      ${headline("How was your journey?")}
      ${paragraph(`We hope the drive was effortless, ${esc(o.firstName)}. A word from you helps us hold our standard &mdash; it takes about thirty seconds.`)}
    </td></tr>

    ${sectionSpacer(32)}
    <tr><td style="padding:0 44px;text-align:center;">
      <div style="font-family:${SERIF};font-size:27px;letter-spacing:7px;color:${GOLD};">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
    </td></tr>
    ${sectionSpacer(26)}

    <tr><td style="padding:0 44px;text-align:center;">
      ${button(o.reviewUrl, "Leave a Review")}
      ${o.googleUrl ? `<div style="padding-top:16px;">${secondaryLink(o.googleUrl, "Or review us on Google")}</div>` : ""}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">
      <div style="height:1px;background-color:${RULE};font-size:0;line-height:0;">&nbsp;</div>
    </td></tr>
    ${sectionSpacer(20)}

    <tr><td style="padding:0 44px;text-align:center;">
      <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${LABEL};">
        Reference <span style="color:${GOLD};letter-spacing:2px;">${esc(o.confirmationCode)}</span><br>
        Something not right? Reply to this email and we will make it right.
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 7. Job sheet (driver) ───────────────────────────────────

/**
 * The booking, to the chauffeur who will drive it.
 *
 * This was the last email still on the old dark gradient layout after the
 * rest moved here, so a driver's inbox showed a different company from the
 * customer's. Same card, same bands; the only things a driver needs at a
 * glance — client, phone, where, when, what to bring — are the rows.
 */
export function driverJobCard(o: {
  driverName: string; confirmationCode: string;
  guestName: string; guestPhone: string;
  pickupAddress: string; dropoffAddress?: string | null;
  pickupDatetime: string; vehicle: string;
  passengers: number; luggage: number;
  flightNumber?: string | null;
  extras?: string | null; tipAmount?: number; notes?: string | null;
  driverAmount?: number | null;
  /** What the chauffeur collects from the client on the day, if anything. */
  collectAmount?: number | null;
}): string {
  const phoneDigits = o.guestPhone.replace(/\D/g, "");
  const waGuest = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hello, I am your Elite BCN chauffeur for booking ${o.confirmationCode}.`)}`;
  const waDispatch = `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(`Dispatch — booking ${o.confirmationCode}`)}`;
  const firstName = o.driverName.split(" ")[0] || o.driverName;

  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Chauffeur · New Job")}
      ${headline(`A booking is yours, ${esc(firstName)}.`)}
      ${paragraph(o.collectAmount && o.collectAmount > 0
        ? "Please read the details below and confirm you can take it. Part of the fare is collected from the client at the end of the journey."
        : "Please read the details below and confirm you can take it. The client has already paid.")}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">${referencePanel(o.confirmationCode, "Quote this reference with dispatch")}</td></tr>
    ${collectPanel(o.collectAmount)}
    ${sectionSpacer(12)}

    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Client", `<strong style="font-weight:bold;">${esc(o.guestName)}</strong>`) +
        row("Phone", `<a href="tel:${esc(o.guestPhone)}" style="color:${GOLD};text-decoration:none;">${esc(o.guestPhone)}</a>`) +
        row("Pick-up", esc(o.pickupAddress)) +
        row("Drop-off", esc(o.dropoffAddress || "—")) +
        row("When", `<strong style="font-weight:bold;">${esc(o.pickupDatetime)}</strong>`) +
        row("Vehicle", esc(o.vehicle)) +
        row("Guests", `${o.passengers} pax &nbsp;&middot;&nbsp; ${o.luggage} bags`) +
        (o.flightNumber ? row("Flight", `<span style="letter-spacing:1.5px;">${esc(o.flightNumber)}</span>`) : "") +
        (o.extras ? row("Bring", `<strong style="font-weight:bold;color:${GOLD};">${esc(o.extras)}</strong>`) : "") +
        (o.tipAmount && o.tipAmount > 0 ? row("Tip", `<span style="color:${GOLD};">&euro;${o.tipAmount.toFixed(2)}</span> <span style="color:${LABEL};">already paid by the client</span>`) : "") +
        row("Notes", esc(o.notes || "—"), true),
      )}
    </td></tr>

    ${o.driverAmount != null ? `
      ${sectionSpacer(28)}
      <tr><td style="padding:0 44px;">${amountBar("Your earnings", o.driverAmount)}</td></tr>
    ` : ""}
    ${sectionSpacer(32)}

    <tr><td style="padding:0 44px;text-align:center;">
      ${button(waGuest, "Message The Client")}
      <div style="padding-top:16px;">${secondaryLink(waDispatch, "Contact dispatch")}</div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 8. Payment failed (customer) ────────────────────────────

export function paymentFailedCard(o: {
  firstName: string; confirmationCode: string; retryUrl: string;
}): string {
  const wa = `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(`Payment issue for booking ${o.confirmationCode}`)}`;
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Payment Unsuccessful")}
      ${headline(`Your payment did not go through, ${esc(o.firstName)}.`)}
      ${paragraph("Your booking is still saved and nothing has been charged. Retry below to confirm your transfer.")}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">${referencePanel(o.confirmationCode, "No charge has been made to your account")}</td></tr>
    ${sectionSpacer(32)}

    <tr><td style="padding:0 44px;text-align:center;">
      ${button(o.retryUrl, "Retry Payment")}
      <div style="padding-top:16px;">${secondaryLink(wa, "Having trouble? Message our team")}</div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 9. Booking cancelled (customer) ─────────────────────────

export function bookingCancelledCard(o: {
  firstName: string; confirmationCode: string;
  pickupDatetime?: string | null; totalAmount: number;
  /** processed: refund sent · pending: may follow · none: nothing was charged or nothing is due */
  refund: "processed" | "pending" | "none";
}): string {
  const wa = `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(`Question about cancelled booking ${o.confirmationCode}`)}`;
  const refundLine =
    o.refund === "processed" ? `&euro;${o.totalAmount.toFixed(2)} is on its way back to your original payment method and should arrive within 3&ndash;5 business days.` :
    o.refund === "pending"   ? "If a refund applies under our policy, it will reach your original payment method within 5&ndash;7 business days." :
                               "No payment was charged for this booking, or a refund was not applicable under our policy.";

  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Booking Cancelled")}
      ${headline(`Your booking has been cancelled, ${esc(o.firstName)}.`)}
      ${paragraph(refundLine)}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Reference", `<span style="letter-spacing:2px;color:${GOLD};">${esc(o.confirmationCode)}</span>`) +
        (o.pickupDatetime ? row("Was booked for", esc(o.pickupDatetime)) : "") +
        row("Amount", `&euro;${o.totalAmount.toFixed(2)}`, true),
      )}
    </td></tr>
    ${sectionSpacer(32)}

    <tr><td style="padding:0 44px;text-align:center;">
      ${button(`${SITE_URL}/book`, "Book a New Transfer")}
      <div style="padding-top:16px;">${secondaryLink(wa, "Questions? Message our team")}</div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 10. Booking cancelled (admin) ───────────────────────────

export function adminCancellationCard(o: {
  confirmationCode: string; guestName: string; guestEmail: string;
  totalAmount: number; refundProcessed: boolean;
  pickupDatetime: string; pickupAddress: string;
}): string {
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Admin · Cancellation")}
      ${headline("A customer has cancelled.")}
      ${paragraph(o.refundProcessed
        ? "The refund went through automatically. Nothing to do unless a chauffeur was already assigned."
        : "No refund was issued automatically &mdash; check whether one is owed under the policy.")}
    </td></tr>

    ${sectionSpacer(28)}
    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Booking", `<span style="letter-spacing:2px;color:${GOLD};">${esc(o.confirmationCode)}</span>`) +
        row("Guest", `${esc(o.guestName)}<br><a href="mailto:${esc(o.guestEmail)}" style="color:${GOLD};text-decoration:none;">${esc(o.guestEmail)}</a>`) +
        row("Pick-up", esc(o.pickupAddress)) +
        row("Was booked for", esc(o.pickupDatetime)) +
        row("Amount", `&euro;${o.totalAmount.toFixed(2)}`) +
        row("Refund", o.refundProcessed ? "Processed automatically" : `<strong style="font-weight:bold;color:${GOLD};">Manual action may be needed</strong>`, true),
      )}
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 11. Pick-up changed (customer) ──────────────────────────

export function pickupChangedCard(o: {
  firstName: string; confirmationCode: string;
  newPickupAddress: string; pickupDatetime: string;
}): string {
  const wa = `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(`Booking ${o.confirmationCode} — pick-up address`)}`;
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Pick-up Updated")}
      ${headline(`Your pick-up address has changed, ${esc(o.firstName)}.`)}
      ${paragraph("Your chauffeur will be directed to the new address. If you need anything else changed, please tell us at least 8 hours before pick-up.")}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Reference", `<span style="letter-spacing:2px;color:${GOLD};">${esc(o.confirmationCode)}</span>`) +
        row("New pick-up", `<strong style="font-weight:bold;">${esc(o.newPickupAddress)}</strong>`) +
        row("Date", esc(o.pickupDatetime), true),
      )}
    </td></tr>
    ${sectionSpacer(32)}

    <tr><td style="padding:0 44px;text-align:center;">
      ${button(wa, "Message Our Team")}
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 12. Pick-up changed (admin) ─────────────────────────────

export function adminPickupChangedCard(o: {
  confirmationCode: string; guestName: string; guestEmail: string;
  oldPickupAddress: string; newPickupAddress: string; pickupDatetime: string;
}): string {
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Admin · Pick-up Changed")}
      ${headline("A customer moved their pick-up.")}
      ${paragraph("If a chauffeur has already been sent the job, tell them the new address.")}
    </td></tr>

    ${sectionSpacer(28)}
    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Booking", `<span style="letter-spacing:2px;color:${GOLD};">${esc(o.confirmationCode)}</span>`) +
        row("Guest", `${esc(o.guestName)}<br><a href="mailto:${esc(o.guestEmail)}" style="color:${GOLD};text-decoration:none;">${esc(o.guestEmail)}</a>`) +
        row("Was", `<span style="color:${LABEL};text-decoration:line-through;">${esc(o.oldPickupAddress)}</span>`) +
        row("Now", `<strong style="font-weight:bold;">${esc(o.newPickupAddress)}</strong>`) +
        row("Date", esc(o.pickupDatetime), true),
      )}
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 13. Job for a fleet partner company ─────────────────────

export function partnerJobCard(o: {
  contactName: string; companyName: string; confirmationCode: string;
  pickupAddress: string; dropoffAddress?: string | null; pickupDatetime: string;
  vehicle: string; passengers: number; luggage: number; flightNumber?: string | null;
  payout: number; panelUrl: string;
  /** What the driver collects from the client on the day, if anything. */
  collectAmount?: number | null;
}): string {
  const firstName = o.contactName.split(" ")[0] || o.contactName;
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Fleet Partner · New Job")}
      ${headline(`A job for ${esc(o.companyName)}, ${esc(firstName)}.`)}
      ${paragraph("Elite BCN has sent this journey to your company. Open your dispatch panel to put one of your drivers on it.")}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">${referencePanel(o.confirmationCode, "Quote this reference with Elite BCN dispatch")}</td></tr>
    ${sectionSpacer(12)}

    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Pick-up", esc(o.pickupAddress)) +
        row("Drop-off", esc(o.dropoffAddress || "—")) +
        row("When", `<strong style="font-weight:bold;">${esc(o.pickupDatetime)}</strong>`) +
        row("Vehicle", esc(o.vehicle)) +
        row("Guests", `${o.passengers} pax &nbsp;&middot;&nbsp; ${o.luggage} bags`) +
        (o.flightNumber ? row("Flight", `<span style="letter-spacing:1.5px;">${esc(o.flightNumber)}</span>`, true) : row("Flight", "—", true)),
      )}
    </td></tr>

    ${sectionSpacer(28)}
    <tr><td style="padding:0 44px;">${amountBar("Your payout", o.payout, "on completion")}</td></tr>
    ${collectPanel(o.collectAmount)}
    ${sectionSpacer(32)}

    <tr><td style="padding:0 44px;text-align:center;">
      ${button(o.panelUrl, "Open Dispatch Panel")}
      <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${LABEL};padding-top:18px;">
        The client's name and phone are shown in the panel, not in this email.
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 14. Partner dispatched a driver (admin) ─────────────────

export function adminPartnerDispatchCard(o: {
  companyName: string; confirmationCode: string;
  pickupAddress: string; dropoffAddress?: string | null; pickupDatetime: string;
  driverName: string; driverEmail?: string | null; driverPhone: string;
  vehicleMake: string; vehicleModel: string; licensePlate: string;
  payout: number; driverAmount?: number | null;
}): string {
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Admin · Partner Dispatch")}
      ${headline(`${esc(o.companyName)} has put a driver on ${esc(o.confirmationCode)}.`)}
      ${paragraph("The customer has been sent the chauffeur's details under the Elite BCN name.")}
    </td></tr>

    ${sectionSpacer(28)}
    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Driver", `<strong style="font-weight:bold;">${esc(o.driverName)}</strong>`) +
        row("Phone", `<a href="tel:${esc(o.driverPhone)}" style="color:${GOLD};text-decoration:none;">${esc(o.driverPhone)}</a>`) +
        (o.driverEmail ? row("Email", `<a href="mailto:${esc(o.driverEmail)}" style="color:${GOLD};text-decoration:none;">${esc(o.driverEmail)}</a>`) : "") +
        row("Vehicle", `${esc(o.vehicleMake)} ${esc(o.vehicleModel)}`) +
        row("Plate", `<span style="letter-spacing:1.5px;">${esc(o.licensePlate)}</span>`) +
        row("Company", esc(o.companyName)) +
        row("Pick-up", esc(o.pickupAddress)) +
        row("Drop-off", esc(o.dropoffAddress || "—")) +
        row("When", `<strong style="font-weight:bold;">${esc(o.pickupDatetime)}</strong>`) +
        row("Payout", `&euro;${o.payout.toFixed(2)} <span style="color:${LABEL};">to the company</span>`) +
        row("Driver sees", o.driverAmount != null ? `&euro;${o.driverAmount.toFixed(2)}` : "—", true),
      )}
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 15. Sign-in details ─────────────────────────────────────

/**
 * A temporary password for a new driver, partner or reset customer. The
 * password is shown once; the account is flagged to change it at first
 * sign-in, so this email stops working the moment they choose their own.
 */
export function credentialsCard(o: {
  firstName: string; email: string; password: string; portalLabel: string; loginUrl: string;
}): string {
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Your Sign-in Details")}
      ${headline(`Welcome, ${esc(o.firstName)}.`)}
      ${paragraph(`Here is your access to the Elite BCN ${esc(o.portalLabel)}. You will be asked to choose your own password the first time you sign in.`)}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};border:1px solid ${GOLD_EDGE};">
        <tr><td style="padding:24px 28px;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${LABEL};">Email</div>
          <div style="font-family:${SANS};font-size:15px;color:${TITLE};padding-top:6px;">${esc(o.email)}</div>
          <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${LABEL};padding-top:18px;">Temporary password</div>
          <div style="font-family:'Courier New',Courier,monospace;font-size:22px;letter-spacing:3px;color:${GOLD};padding-top:6px;">${esc(o.password)}</div>
        </td></tr>
      </table>
    </td></tr>
    ${sectionSpacer(32)}

    <tr><td style="padding:0 44px;text-align:center;">
      ${button(o.loginUrl, "Sign In")}
      <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${LABEL};padding-top:18px;">
        This password is temporary. Please do not forward this email — anyone who reads it can sign in until you change it.
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 16. Customer account became a company login ─────────────

export function partnerConvertedCard(o: { contactName: string; companyName: string; panelUrl: string }): string {
  const firstName = o.contactName.split(" ")[0] || o.contactName;
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Fleet Partner")}
      ${headline(`Your panel is ready, ${esc(firstName)}.`)}
      ${paragraph(`${esc(o.companyName)} is now a fleet partner of Elite BCN. Your existing sign-in and password now open the company panel, where you add your drivers and dispatch the jobs Elite BCN sends you.`)}
    </td></tr>
    ${sectionSpacer(32)}
    <tr><td style="padding:0 44px;text-align:center;">
      ${button(o.panelUrl, "Open Dispatch Panel")}
      <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${LABEL};padding-top:18px;">
        Sign in with the same email and password as before.
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 17. You left your booking (customer) ────────────────────

/**
 * The recovery email. Sent once, automatically, a quarter of an hour after
 * someone with a name and an email went quiet on the form or left a booking
 * unpaid. It shows them what they were booking, gives them the price they
 * saw, and offers two ways back: the button that resumes the booking, and
 * WhatsApp to a person.
 */
export function abandonedRecoveryCard(o: {
  firstName: string;
  pickup: string; dropoff?: string | null;
  date?: string | null; time?: string | null;
  vehicle?: string | null; passengers?: number | null;
  amount?: number | null;
  resumeUrl: string;
}): string {
  const wa = `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(`Hello, I was booking a transfer ${o.pickup}${o.dropoff ? ` to ${o.dropoff}` : ""}${o.date ? ` on ${o.date}` : ""}. Can you help me finish it?`)}`;
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Your Booking")}
      ${headline(`Your transfer is still waiting, ${esc(o.firstName)}.`)}
      ${paragraph("You started booking with Elite BCN and did not finish. Nothing has been charged and nothing is lost: everything you entered is below, and one tap picks it up where you left it.")}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Pick-up", esc(o.pickup)) +
        (o.dropoff ? row("Drop-off", esc(o.dropoff)) : "") +
        (o.date ? row("Date", `${esc(o.date)}${o.time ? ` &nbsp;&middot;&nbsp; ${esc(o.time)}` : ""}`) : "") +
        (o.vehicle ? row("Vehicle", esc(o.vehicle)) : "") +
        row("Guests", o.passengers ? String(o.passengers) : "—", true),
      )}
    </td></tr>

    ${o.amount && o.amount > 0 ? `
      ${sectionSpacer(28)}
      <tr><td style="padding:0 44px;">${amountBar("Your fixed price", o.amount, "all included, no surprises")}</td></tr>
    ` : ""}

    ${sectionSpacer(32)}

    <tr><td style="padding:0 44px;text-align:center;">
      ${button(o.resumeUrl, "Finish My Booking")}
      <div style="padding-top:16px;">${secondaryLink(wa, "Talk to us on WhatsApp")}</div>
      <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${LABEL};padding-top:18px;">
        Prefer to talk? We are on
        <a href="tel:${PHONE_DIGITS}" style="color:${GOLD};text-decoration:none;">${PHONE}</a>
        24 hours a day, in English and Spanish, and we will always find you our best rate.
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 18. A note from the office (customer) ───────────────────

/**
 * The office writing to a customer in its own words, on the same card as
 * everything else. Line breaks are kept; nothing else is interpreted.
 */
export function personalNoteCard(o: {
  firstName: string; message: string; signedBy?: string | null;
  resumeUrl?: string | null;
}): string {
  const wa = `https://wa.me/${PHONE_DIGITS}`;
  const body = esc(o.message).replace(/\r?\n/g, "<br>");
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("A note from Elite BCN")}
      ${headline(`Hello, ${esc(o.firstName)}.`)}
      <div style="font-family:${SANS};font-size:15px;line-height:25px;color:${TEXT};padding-top:16px;">${body}</div>
      ${o.signedBy ? `<div style="font-family:${SANS};font-size:14px;color:${TITLE};padding-top:18px;">${esc(o.signedBy)}<br><span style="color:${LABEL};font-size:12px;">Elite BCN Transfers</span></div>` : ""}
    </td></tr>
    ${sectionSpacer(32)}
    <tr><td style="padding:0 44px;text-align:center;">
      ${o.resumeUrl ? button(o.resumeUrl, "Finish My Booking") : button(wa, "Message Us on WhatsApp")}
      ${o.resumeUrl ? `<div style="padding-top:16px;">${secondaryLink(wa, "Talk to us on WhatsApp")}</div>` : ""}
      <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${LABEL};padding-top:18px;">
        Or call <a href="tel:${PHONE_DIGITS}" style="color:${GOLD};text-decoration:none;">${PHONE}</a>, any hour.
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 18b. Sign-in address changed (driver) ───────────────────

/**
 * A fleet company changed one of its drivers' email addresses.
 *
 * Sent to both the old and the new address: the new one because that is the
 * login from now on, the old one because a driver who did not ask for this
 * needs somewhere to find out that it happened.
 */
export function driverEmailChangedCard(o: { firstName: string; newEmail: string; company: string }): string {
  const wa = `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent("Hello, my Elite BCN sign-in address has changed and I did not expect it.")}`;
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Chauffeur · Sign-in")}
      ${headline(`Your sign-in address has changed, ${esc(o.firstName)}.`)}
      ${paragraph(`${esc(o.company)} has updated the email on your chauffeur account. From now on you sign in with the address below. Your password has not changed.`)}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">${detailTable(row("Sign in with", `<strong style="font-weight:bold;color:${GOLD};">${esc(o.newEmail)}</strong>`, true))}</td></tr>
    ${sectionSpacer(28)}

    <tr><td style="padding:0 44px;text-align:center;">
      ${button(`${SITE_URL}/driver`, "Open Your Panel")}
      <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${LABEL};padding-top:18px;">
        If you did not expect this, ${"" }<a href="${wa}" style="color:${GOLD};text-decoration:none;">tell us on WhatsApp</a> straight away.
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 19. The journey home (customer) ─────────────────────────

/**
 * Three days after a completed one-way journey, for a customer who has not
 * booked again: the same route the other way round, pre-filled, 5% off. One
 * button. Sent once per booking, by the daily job.
 */
export function returnRebookCard(o: {
  firstName: string;
  /** Where they were dropped: the pick-up for the journey home. */
  from: string;
  /** Where they were collected: the drop-off for the journey home. */
  to: string;
  discountPct: number;
  rebookUrl: string;
}): string {
  const wa = `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(`Hello, I would like to book my return journey from ${o.from} to ${o.to}.`)}`;
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("The Journey Home")}
      ${headline(`Heading back, ${esc(o.firstName)}?`)}
      ${paragraph(`Thank you for travelling with Elite BCN. When it is time to go home, the same chauffeur service is ready the other way round &mdash; and as a returning guest you have <strong style="color:${TITLE};">${o.discountPct}% off</strong> the fare. The route is already filled in; choose your date and time and it is done.`)}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">
      ${detailTable(
        row("Pick-up", esc(o.from)) +
        row("Drop-off", esc(o.to)) +
        row("Your discount", `<strong style="font-weight:bold;color:${GOLD};">${o.discountPct}% off</strong> <span style="color:${LABEL};">applied at the checkout</span>`, true),
      )}
    </td></tr>

    ${sectionSpacer(32)}
    <tr><td style="padding:0 44px;text-align:center;">
      ${button(o.rebookUrl, "Book My Return Journey")}
      <div style="padding-top:16px;">${secondaryLink(wa, "Or ask us on WhatsApp")}</div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 9. Flight alert (operations) ────────────────────────────

/**
 * What operations actually needs to see about a delayed flight.
 *
 * The alert this replaces was four lines of plain text in a grey box: the
 * flight number, the new landing time, the pickup address and whether a
 * driver was assigned. It answered "how late" and nothing else, so the only
 * way to judge whether that estimate was worth acting on — has the aircraft
 * even left yet, and how late did it leave? — was to go and look the flight
 * up somewhere else.
 *
 * Everything below was already in the provider's response and was being
 * thrown away. It is laid out as the boarding pass the reader already has in
 * their head: origin on the left, destination on the right, scheduled under
 * actual, and the terminals a driver has to drive to.
 *
 * On depth: an email is not a web page. There is no JavaScript, no transform,
 * and in Gmail no stylesheet at all — so dimension here is layered panels, a
 * lit top edge and a gradient across the route rule, which every client
 * renders, rather than anything that collapses to a flat mess in the one
 * client this alert is actually read in.
 */
export function flightOpsCard(o: {
  confirmationCode: string;
  flightNumber: string;
  airline?: string | null;
  /** "delayed", "cancelled", "diverted", "en_route", "landed"… */
  state?: string | null;
  delayMinutes?: number | null;
  from?: { code?: string | null; name?: string | null; terminal?: string | null; scheduled?: string | null; actual?: string | null } | null;
  to?:   { code?: string | null; name?: string | null; terminal?: string | null; scheduled?: string | null; estimated?: string | null } | null;
  /** "3h 27m", when both ends are known. */
  duration?: string | null;
  pickupAddress: string;
  passenger?: string | null;
  driver?: string | null;
  bookingUrl: string;
}): string {
  const late = typeof o.delayMinutes === "number" && o.delayMinutes > 0;
  const grave = o.state === "cancelled" || o.state === "diverted";
  // Red is kept for the two states where the car may not be wanted at all. A
  // late flight is routine; colouring it red as well would mean neither
  // colour said anything.
  const accent = grave ? "#C2553F" : GOLD;
  const accentEdge = grave ? "#7A3327" : GOLD_EDGE;
  const stripBg = grave ? "#2E1E1B" : "#2B2520";

  const stateLabel = grave
    ? (o.state === "cancelled" ? "Cancelled" : "Diverted")
    : late ? `${o.delayMinutes} min late`
    : o.state === "landed" ? "Landed"
    : o.state === "en_route" ? "In the air"
    : "Schedule changed";

  // headline() does not escape what it is given. The flight number is
  // normalised to letters and digits upstream, but that is a guarantee made
  // somewhere else and cheap to stop depending on here.
  const fn = esc(o.flightNumber);
  const headline_ = grave
    ? `${fn} is ${o.state === "cancelled" ? "cancelled" : "diverted"}`
    : late
      ? `${fn} is ${o.delayMinutes} minutes late`
      : `${fn} has a new schedule`;

  /** One end of the journey: big code, airport beneath, times beneath that. */
  const endpoint = (
    align: "left" | "right",
    code: string, name: string, terminal: string | null,
    headTime: string | null, headLabel: string,
    subTime: string | null, subLabel: string,
  ) => `
    <td width="37%" align="${align}" style="vertical-align:top;">
      <div style="font-family:${SERIF};font-size:34px;line-height:36px;letter-spacing:2px;color:${TITLE};">${esc(code)}</div>
      <div style="font-family:${SANS};font-size:11px;line-height:16px;color:${LABEL};padding-top:6px;">${esc(name)}</div>
      ${terminal ? `<div style="font-family:${SANS};font-size:11px;line-height:16px;color:${accent};padding-top:3px;">Terminal ${esc(terminal)}</div>` : ""}
      ${headTime ? `
      <div style="font-family:${SANS};font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${LABEL};padding-top:14px;">${esc(headLabel)}</div>
      <div style="font-family:${SERIF};font-size:20px;line-height:24px;color:${TITLE};padding-top:2px;">${esc(headTime)}</div>` : ""}
      ${subTime ? `
      <div style="font-family:${SANS};font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${LABEL};padding-top:9px;">${esc(subLabel)}</div>
      <div style="font-family:${SANS};font-size:13px;line-height:18px;color:${TEXT};padding-top:1px;">${esc(subTime)}</div>` : ""}
    </td>`;

  const from = o.from ?? {};
  const to = o.to ?? {};

  const driverKnown = !!o.driver && o.driver !== "NOT YET ASSIGNED";

  const strip = late || grave
    ? `<tr><td style="padding:14px 22px;border-top:1px solid ${accentEdge};background-color:${stripBg};">
          <div style="font-family:${SANS};font-size:12px;line-height:19px;color:${accent};">
            ${grave
              ? "The car may not be wanted. Confirm with the passenger before dispatching."
              : `The pick-up moves with the aircraft. ${driverKnown ? `${esc(o.driver)} has been told.` : "No driver is assigned yet."}`}
          </div>
        </td></tr>`
    : "";

  return card(`
    <tr><td style="padding:40px 40px 0 40px;">
      ${eyebrow("Operations · Flight watch")}
      ${headline(headline_)}
    </td></tr>

    <tr><td style="padding:26px 40px 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};border:1px solid ${RULE};">

        <!-- a lit top edge: the cheap trick that reads as raised -->
        <tr><td style="height:1px;background-color:#3D414A;font-size:0;line-height:0;">&nbsp;</td></tr>

        <tr><td style="padding:16px 22px;border-bottom:1px solid ${RULE};background-color:#22262C;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="left" style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${LABEL};">${esc(o.airline || "Flight")}</td>
            <td align="right" style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${accent};">${esc(stateLabel)}</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:24px 22px 22px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            ${endpoint("left",
              from.code || "—", from.name || "Departure", from.terminal ?? null,
              from.actual || from.scheduled || null, from.actual ? "Took off" : "Departs",
              from.actual && from.scheduled ? from.scheduled : null, "Scheduled")}

            <td width="26%" align="center" style="vertical-align:top;padding-top:10px;">
              <div style="font-family:${SERIF};font-size:13px;color:${accent};letter-spacing:4px;">${esc(o.flightNumber)}</div>
              <div style="height:2px;margin:12px 0 10px 0;background-color:${accentEdge};background-image:linear-gradient(to right,${BG},${accent},${BG});font-size:0;line-height:0;">&nbsp;</div>
              ${o.duration ? `<div style="font-family:${SANS};font-size:11px;color:${LABEL};">${esc(o.duration)}</div>` : ""}
            </td>

            ${endpoint("right",
              to.code || "BCN", to.name || "Barcelona", to.terminal ?? null,
              to.estimated || to.scheduled || null, to.estimated ? "Now lands" : "Lands",
              to.estimated && to.scheduled ? to.scheduled : null, "Scheduled")}
          </tr></table>
        </td></tr>

        ${strip}
      </table>
    </td></tr>

    <tr><td style="padding:26px 40px 0 40px;">
      ${detailTable(
        row("Booking", esc(o.confirmationCode)) +
        (o.passenger ? row("Passenger", esc(o.passenger)) : "") +
        row("Pick-up", esc(o.pickupAddress)) +
        row("Driver", driverKnown
          ? esc(o.driver)
          : `<span style="color:${accent};">Not yet assigned</span>`, true),
      )}
    </td></tr>

    <tr><td style="padding:26px 40px 0 40px;">
      ${button(o.bookingUrl, "Open the booking")}
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

// ─── 10. The emails that were never on this template ─────────

/**
 * A long string that must not be broken, in a box that can hold it.
 *
 * A reset link is the one thing in an email that has to survive being
 * copied by hand, so it is shown as well as linked.
 */
function monoBox(text: string): string {
  return `<div style="background-color:#1B1E23;border:1px solid ${RULE};padding:12px 14px;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:19px;color:#9A9AA2;word-break:break-all;">${esc(text)}</div>`;
}

/**
 * Resetting a password.
 *
 * This was the worst of the off-template emails, and the one it mattered
 * most on. It was styled with a <style> block and CSS classes, and Gmail
 * strips those: what arrived was unstyled black text on white with a bare
 * link in the middle of it. An unstyled email asking you to click a link and
 * type a password is indistinguishable from a phishing attempt, which is
 * exactly the wrong thing for the one message where a customer is deciding
 * whether to trust us.
 */
export function passwordResetCard(o: {
  name?: string | null;
  email: string;
  resetUrl: string;
  /** How long the link lives, in words. */
  expiresIn: string;
}): string {
  return card(`
    <tr><td style="padding:40px 40px 0 40px;">
      ${eyebrow("Account")}
      ${headline("Reset your password")}
      ${paragraph(`Hello${o.name ? ` ${esc(o.name)}` : ""}, we were asked to reset the password for <span style="color:${GOLD};">${esc(o.email)}</span>.`)}
      ${paragraph(`Choose a new one with the button below. The link works once and expires in ${esc(o.expiresIn)}.`, 12)}
    </td></tr>

    <tr><td style="padding:28px 40px 0 40px;">
      ${button(o.resetUrl, "Choose a new password")}
    </td></tr>

    <tr><td style="padding:26px 40px 0 40px;">
      <div style="font-family:${SANS};font-size:12px;line-height:20px;color:${LABEL};padding-bottom:10px;">Or paste this into your browser:</div>
      ${monoBox(o.resetUrl)}
    </td></tr>

    <tr><td style="padding:26px 40px 0 40px;">
      <div style="border-top:1px solid ${RULE};padding-top:18px;font-family:${SANS};font-size:12px;line-height:20px;color:${LABEL};">
        If you did not ask for this, nothing has happened and you can ignore this message. Your password stays as it is.
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

/** Someone has joined the newsletter. */
export function newsletterWelcomeCard(o: {
  name?: string | null;
  unsubscribeUrl: string;
}): string {
  return card(`
    <tr><td style="padding:40px 40px 0 40px;">
      ${eyebrow("Newsletter")}
      ${headline("You are on the list")}
      ${paragraph(`Thank you${o.name ? `, ${esc(o.name)}` : ""}. We will write occasionally with routes worth knowing about, what Barcelona is like at the time of year you are coming, and the odd offer. Not often, and never noise.`)}
    </td></tr>

    <tr><td style="padding:28px 40px 0 40px;">
      ${button(`${SITE_URL}/book`, "Book a transfer")}
    </td></tr>

    <tr><td style="padding:26px 40px 0 40px;">
      <div style="border-top:1px solid ${RULE};padding-top:18px;">
        ${secondaryLink(o.unsubscribeUrl, "Unsubscribe")}
      </div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

/**
 * An enquiry from the contact form, for whoever answers it.
 *
 * Reply-to is set to the customer, so the reply goes to them and not to us —
 * which is why the address is shown as plainly as it is.
 */
export function contactEnquiryCard(o: {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
}): string {
  return card(`
    <tr><td style="padding:40px 40px 0 40px;">
      ${eyebrow("Enquiry · elitebcn.info")}
      ${headline(esc(o.name))}
    </td></tr>

    <tr><td style="padding:24px 40px 0 40px;">
      ${detailTable(
        row("Email", `<a href="mailto:${encodeURIComponent(o.email)}" style="color:${GOLD};text-decoration:none;">${esc(o.email)}</a>`) +
        row("Phone", o.phone ? `<a href="tel:${esc(o.phone).replace(/[^+0-9]/g, "")}" style="color:${GOLD};text-decoration:none;">${esc(o.phone)}</a>` : "Not given", true),
      )}
    </td></tr>

    <tr><td style="padding:24px 40px 0 40px;">
      <div style="background-color:${PANEL};border:1px solid ${RULE};padding:20px 22px;">
        <div style="font-family:${SANS};font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:${LABEL};padding-bottom:10px;">Message</div>
        <div style="font-family:${SANS};font-size:14px;line-height:23px;color:${TITLE};white-space:pre-wrap;">${esc(o.message)}</div>
      </div>
    </td></tr>

    <tr><td style="padding:22px 40px 0 40px;">
      <div style="font-family:${SANS};font-size:12px;line-height:20px;color:${LABEL};">Reply to this email and it goes straight to them.</div>
    </td></tr>
    ${sectionSpacer(42)}
  `);
}

/**
 * Anything the office needs told, in the house style.
 *
 * Replaces a grey box with the message pasted into it, which is what every
 * operational alert looked like: a new lead, a cancellation, a failed
 * payment, the email test, all identical and all unreadable at a glance.
 */
export function adminNoticeCard(o: {
  eyebrow?: string;
  title: string;
  /** Free text under the title. Newlines become line breaks. */
  body?: string | null;
  /** A table of label/value pairs, shown under the body. */
  facts?: [string, string][];
  ctaUrl?: string | null;
  ctaText?: string | null;
}): string {
  const facts = (o.facts ?? []).filter(([, v]) => v != null && v !== "");
  return card(`
    <tr><td style="padding:40px 40px 0 40px;">
      ${eyebrow(o.eyebrow ?? "Operations")}
      ${headline(esc(o.title))}
      ${o.body ? `<div style="font-family:${SANS};font-size:14px;line-height:23px;color:${TEXT};padding-top:16px;white-space:pre-wrap;">${esc(o.body)}</div>` : ""}
    </td></tr>

    ${facts.length ? `<tr><td style="padding:24px 40px 0 40px;">
      ${detailTable(facts.map(([k, v], i) => row(k, esc(v), i === facts.length - 1)).join(""))}
    </td></tr>` : ""}

    ${o.ctaUrl ? `<tr><td style="padding:26px 40px 0 40px;">
      ${button(o.ctaUrl, o.ctaText ?? "Open the admin panel")}
    </td></tr>` : ""}
    ${sectionSpacer(42)}
  `);
}

/**
 * An email whose body is built elsewhere, given the house shell.
 *
 * For the daily AI briefing, which is a dense table of its own and would be
 * worse rewritten than wrapped. This gives it the masthead, the footer and
 * the colour-scheme declaration that stops Gmail repainting it, without
 * touching how it lays its own data out.
 */
export function wrappedCard(innerHtml: string): string {
  return card(`<tr><td style="padding:36px 32px;">${innerHtml}</td></tr>`);
}

/**
 * A booking that has come in and needs a chauffeur put on it.
 *
 * This had its own hand-built document — a light cream one, with its own
 * masthead reading "Admin · Operations" and its own footer reading "Internal
 * notification". It was the last email not on this template, and it hid from
 * the audit because it lives in the same file as twenty that are: the check
 * looked per file rather than per email.
 *
 * Two templates is worse than one in a way that is easy to miss. Gmail's dark
 * mode inverts both, and inverting a light template and a dark one gives two
 * different-looking results, which is why the office was seeing some alerts
 * dark-on-light and others light-on-dark.
 */
export function adminNewBookingCard(o: {
  confirmationCode: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  pickupAddress: string;
  dropoffAddress?: string | null;
  /** Pre-split by the caller, as every other card here takes them. */
  date: string;
  time: string;
  vehicleLabel: string;
  passengers: number;
  luggage?: number | null;
  flightNumber?: string | null;
  totalAmount: number;
  /**
   * The customer's own words, with the metadata block already taken out.
   *
   * Never the raw specialRequests. That field carries a [META]{…}[/META]
   * prefix, and printing it whole put a line of JSON in front of the thing
   * the office actually has to read — in the case that found this, a customer
   * explaining that the real pickup was their hotel and not the bar they had
   * been forced to type. parseBookingMeta().notes is the stripped version.
   */
  notes?: string | null;
  /** What was bought on top, already formatted. The driver brings these. */
  extras?: string | null;
  /** Included in the total, but the chauffeur's, so it is shown apart. */
  tipAmount?: number | null;
  /** How the money is arriving, when it is not simply paid in full. */
  paymentNote?: string | null;
}): string {
  return card(`
    <tr><td style="padding:40px 40px 0 40px;">
      ${eyebrow("New booking · Paid")}
      ${headline("A chauffeur is needed")}
    </td></tr>

    <tr><td style="padding:24px 40px 0 40px;">
      ${amountBar("Total", o.totalAmount, o.paymentNote ?? undefined)}
    </td></tr>

    <tr><td style="padding:20px 40px 0 40px;">
      ${referencePanel(o.confirmationCode, "Quote this reference with dispatch")}
    </td></tr>

    <tr><td style="padding:24px 40px 0 40px;">
      ${detailTable(
        row("Client", esc(o.clientName)) +
        row("Contact",
          `<a href="mailto:${encodeURIComponent(o.clientEmail)}" style="color:${GOLD};text-decoration:none;">${esc(o.clientEmail)}</a>` +
          (o.clientPhone ? `<br><a href="tel:${esc(o.clientPhone).replace(/[^+0-9]/g, "")}" style="color:${GOLD};text-decoration:none;">${esc(o.clientPhone)}</a>` : "")) +
        row("Pick-up", esc(o.pickupAddress)) +
        row("Drop-off", esc(o.dropoffAddress || "—")) +
        row("Date", `${esc(o.date)}${o.time ? ` &nbsp;&middot;&nbsp; ${esc(o.time)}` : ""}`) +
        row("Vehicle", `${esc(o.vehicleLabel)} &nbsp;&middot;&nbsp; ${o.passengers} pax${o.luggage != null ? ` &nbsp;&middot;&nbsp; ${o.luggage} bags` : ""}`) +
        (o.flightNumber ? row("Flight", esc(o.flightNumber)) : "") +
        // Somebody has to put the child seat in the car. Dropping this row
        // was how a paid-for extra reached nobody.
        (o.extras ? row("Extras", `<span style="color:${GOLD};">${esc(o.extras)}</span>`) : "") +
        (o.tipAmount ? row("Driver tip", `<span style="color:${GOLD};">&euro;${o.tipAmount.toFixed(2)}</span> <span style="color:${LABEL};">&middot; included in the total</span>`) : "") +
        row("Notes", o.notes ? esc(o.notes) : "—", true),
      )}
    </td></tr>

    <tr><td style="padding:26px 40px 0 40px;">
      ${button(`${SITE_URL}/admin/bookings`, "Assign a driver")}
    </td></tr>
    ${sectionSpacer(42)}
  `);
}
