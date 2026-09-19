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
  /**
   * How the fare is settled, for bookings the office makes by hand. A website
   * booking is paid at checkout and says nothing here. `line` is the sentence
   * the customer reads; `payUrl` adds a pay-by-card button under it.
   */
  payment?: { line: string; payUrl?: string; paid?: boolean };
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
            <div style="font-family:${SERIF};font-size:20px;color:${TITLE};padding-top:8px;">Book the return now, same fixed price.</div>
            <div style="font-family:${SANS};font-size:13px;line-height:21px;color:${TEXT};padding-top:8px;">The route is already filled in the other way round. Choose the date and time and it is done.</div>
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
}): string {
  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Booking Confirmed")}
      ${headline(`Your transfer is confirmed, ${esc(o.firstName)}.`)}
      ${paragraph("Paid in full, and this email is your receipt. Your chauffeur will be assigned shortly and you will hear from us again the day before you travel.")}
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
}): string {
  const phoneDigits = o.guestPhone.replace(/\D/g, "");
  const waGuest = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hello, I am your Elite BCN chauffeur for booking ${o.confirmationCode}.`)}`;
  const waDispatch = `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(`Dispatch — booking ${o.confirmationCode}`)}`;
  const firstName = o.driverName.split(" ")[0] || o.driverName;

  return card(`
    <tr><td style="padding:38px 44px 0 44px;">
      ${eyebrow("Chauffeur · New Job")}
      ${headline(`A booking is yours, ${esc(firstName)}.`)}
      ${paragraph("Please read the details below and confirm you can take it. The client has already paid.")}
    </td></tr>

    ${sectionSpacer(30)}
    <tr><td style="padding:0 44px;">${referencePanel(o.confirmationCode, "Quote this reference with dispatch")}</td></tr>
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
