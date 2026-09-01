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
        row("Pick-up", esc(o.pickupAddress)) +
        row("Drop-off", esc(o.dropoffAddress)) +
        row("Date", `${esc(o.date)}${o.time ? ` &nbsp;&middot;&nbsp; ${esc(o.time)}` : ""}`) +
        row("Vehicle", esc(o.vehicle)) +
        row("Guests", String(o.passengers), true),
      )}
    </td></tr>

    ${sectionSpacer(28)}
    <tr><td style="padding:0 44px;">${amountBar("Total", o.totalAmount, "excl. VAT &amp; tolls")}</td></tr>
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
      ${eyebrow("Admin &middot; Unpaid Enquiry")}
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
            For airport arrivals, they wait in the arrivals hall holding a tablet with your name.<br>
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
}): string {
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Payment Received")}
      ${headline("Your ride is paid in full.")}
      ${paragraph(`Thank you, ${esc(o.firstName)}. This email is your receipt &mdash; no further action is needed.`)}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">${amountBar("Amount Paid", o.totalAmount)}</td></tr>
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

    <tr><td style="padding:0 44px;text-align:center;">${button(o.reviewUrl, "Leave a Review")}</td></tr>

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
