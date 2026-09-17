import { Resend } from "resend";
import { logEmail } from "@/lib/marketing";
import { COMPANY } from "@/lib/company-facts";
import { notifyAdmin } from "@/lib/whatsapp";
import {
  emailDocument,
  bookingReceivedCard,
  newLeadCard,
  rideConfirmedCard,
  driverAssignedCard,
  paymentReceiptCard,
  rideCompleteCard,
  flightDelayCard,
  driverJobCard, paymentFailedCard, bookingCancelledCard, adminCancellationCard,
  pickupChangedCard, adminPickupChangedCard,
  partnerJobCard, adminPartnerDispatchCard, credentialsCard, partnerConvertedCard,
} from "@/lib/email/premium";

let _resend: Resend | undefined;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}
export const resend = new Proxy({} as Resend, { get: (_, p) => (getResend() as any)[p as string] });

// FROM must match a verified domain in Resend dashboard (resend.com/domains)
// Set RESEND_FROM in Vercel env once your domain is verified.
// Until verified, only onboarding@resend.dev works (but only to your Resend account email).
const FROM = process.env.RESEND_FROM ?? "Elite BCN Transfers <noreply@elitebcn.info>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? COMPANY.email;
const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";

async function sendEmail(payload: Parameters<Resend["emails"]["send"]>[0]): Promise<string | undefined> {
  // Default reply-to so customer replies reach the working inbox.
  // Callers that need a different reply-to (e.g. admin alerts that should reply to the guest) set it explicitly.
  if (!payload.replyTo) {
    (payload as unknown as Record<string, unknown>).replyTo = COMPANY.email;
  }
  let result: Awaited<ReturnType<Resend["emails"]["send"]>> | undefined;
  let errMsg: string | undefined;
  try {
    result = await resend.emails.send(payload);
    if (result?.error) errMsg = (result.error as { message?: string }).message ?? JSON.stringify(result.error);
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e);
  }
  if (errMsg) {
    console.error(`[resend] FAILED from=${payload.from} to=${payload.to} subject="${payload.subject}": ${errMsg}`);
    // A refused send used to leave no trace anywhere the office could see.
    // The reason goes into the email log, prefixed, so Admin -> Email Logs
    // shows what Resend said rather than an email that silently never went.
    const to = Array.isArray(payload.to) ? payload.to.join(", ") : String(payload.to);
    await logEmail({ to, subject: `[FAILED: ${errMsg.slice(0, 160)}] ${payload.subject ?? ""}`, type: "FAILED", status: "FAILED" }).catch(() => {});
    throw new Error(`Resend error: ${errMsg}`);
  }
  return result?.data?.id;
}

import { parseBookingMeta, formatExtras } from "@/lib/booking-meta";

// ─── Vehicle class → display name ────────────────────────────
const VEHICLE_NAMES: Record<string, string> = {
  // FleetVehicle keys
  COROLLA:  "Toyota Corolla",
  CAMRY:    "Toyota Camry",
  TESLA_M3: "Tesla Model 3",
  EQE_300:  "Mercedes EQE 300",
  VITO:     "Mercedes Vito",
  V_CLASS:  "Mercedes V-Class",
  SPRINTER: "Mercedes Sprinter",
  // DB VehicleClass keys (for legacy booking records)
  // Tier names as the customer chose them. The Corolla is Economy and the Camry
  // Standard since 17 Aug; these still read "Standard Sedan (Corolla)" and
  // "Business Sedan (Camry)", which now name the wrong tiers.
  ECONOMY:        "Economy (Toyota Corolla)",
  BUSINESS:       "Standard (Toyota Camry)",
  LUXURY:         "Business (Mercedes EQE 300 Electric)",
  ELECTRIC_VIP:   "Electric (Tesla Model 3)",
  MINIVAN:        "Mercedes Vito",
  LUXURY_MINIVAN: "Mercedes V-Class",
  MINIBUS:        "Mercedes Sprinter",
};
function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

function vehicleName(cls: string): string {
  return VEHICLE_NAMES[cls] ?? cls.replace(/_/g, " ");
}

function esc(s: string | number | undefined | null): string {
  return String(s ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitDatetime(dt: string): { date: string; time: string } {
  const parts = dt.split(",").map((p) => p.trim());
  return parts.length >= 2
    ? { date: parts[0], time: parts[1] }
    : { date: dt, time: "" };
}

function adminNewBookingAlertHtml({
  confirmationCode, clientName, clientEmail, clientPhone,
  pickupAddress, dropoffAddress, pickupDatetime, vehicleClass,
  passengers, luggage, flightNumber, totalAmount, specialRequests,
}: {
  confirmationCode: string; clientName: string; clientEmail: string; clientPhone?: string | null;
  pickupAddress: string; dropoffAddress?: string | null; pickupDatetime: string;
  vehicleClass: string; passengers: number; luggage?: number; flightNumber?: string | null;
  totalAmount: number; specialRequests?: string | null;
}): string {
  const { date, time } = splitDatetime(pickupDatetime);
  const code = esc(confirmationCode);
  // Extras were being thrown away here: the metadata block was stripped and
  // only the customer's own note survived, so a paid-for child seat reached
  // nobody who could act on it.
  const meta = parseBookingMeta(specialRequests);
  const notes = esc(meta.notes ?? "") || "—";
  const extrasLine = meta.extras.length ? esc(formatExtras(meta.extras)) : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>New Booking — Elite BCN</title>
</head>
<body style="margin:0; padding:0; background-color:#efece5; -webkit-text-size-adjust:100%;">

<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
  ${code} &middot; ${esc(date)} ${esc(time)} &middot; ${esc(vehicleName(vehicleClass))} &middot; €${totalAmount.toFixed(2)} — driver assignment required.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#efece5;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%;">

    <tr><td style="background-color:#141414; padding:28px 40px; text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:22px; letter-spacing:7px; color:#ffffff;">
        ELITE<span style="color:#c9a96e;">BCN</span>
      </div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:4px; color:#8a8a8a; padding-top:8px;">
        ADMIN &nbsp;&middot;&nbsp; OPERATIONS
      </div>
    </td></tr>
    <tr><td style="height:3px; background-color:#c9a96e; font-size:0; line-height:0;">&nbsp;</td></tr>

    <tr><td style="background-color:#faf8f4; padding:40px 48px 8px 48px;">
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:4px; color:#b39159; text-transform:uppercase;">
        New Booking &middot; Paid
      </div>
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:26px; line-height:34px; color:#1a1a1a; padding-top:12px;">
        Driver assignment required
      </div>
    </td></tr>

    <tr><td style="background-color:#faf8f4; padding:24px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c9a96e; border-radius:2px;">
        <tr>
          <td style="padding:18px 24px;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:3px; color:#9a9a9a; text-transform:uppercase;">Code</span><br>
            <span style="font-family:Georgia,'Times New Roman',serif; font-size:24px; letter-spacing:6px; color:#b39159;">${code}</span>
          </td>
          <td style="padding:18px 24px; text-align:right; vertical-align:middle;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:3px; color:#9a9a9a; text-transform:uppercase;">Amount</span><br>
            <span style="font-family:Georgia,'Times New Roman',serif; font-size:24px; color:#1a1a1a;">€${totalAmount.toFixed(2)}</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="background-color:#faf8f4; padding:8px 48px 16px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6; vertical-align:top; width:120px;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#9a9a9a; text-transform:uppercase;">Client</span>
          </td>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:14px; color:#1a1a1a;">${esc(clientName)}</span>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6; vertical-align:top;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#9a9a9a; text-transform:uppercase;">Contact</span>
          </td>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:14px; line-height:21px; color:#1a1a1a;">
              <a href="mailto:${esc(clientEmail)}" style="color:#b39159; text-decoration:none;">${esc(clientEmail)}</a><br>
              ${clientPhone ? `<a href="tel:${esc(clientPhone)}" style="color:#b39159; text-decoration:none;">${esc(clientPhone)}</a>` : "<span style=\"color:#9a9a9a;\">—</span>"}
            </span>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6; vertical-align:top;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#9a9a9a; text-transform:uppercase;">Pick-up</span>
          </td>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:14px; line-height:21px; color:#1a1a1a;">${esc(pickupAddress)}</span>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6; vertical-align:top;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#9a9a9a; text-transform:uppercase;">Drop-off</span>
          </td>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:14px; line-height:21px; color:#1a1a1a;">${esc(dropoffAddress)}</span>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6; vertical-align:top;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#9a9a9a; text-transform:uppercase;">Date &amp; Time</span>
          </td>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:14px; color:#1a1a1a; font-weight:bold;">${esc(date)}${time ? ` &nbsp;&middot;&nbsp; ${esc(time)}` : ""}</span>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6; vertical-align:top;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#9a9a9a; text-transform:uppercase;">Vehicle</span>
          </td>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:14px; color:#1a1a1a;">${esc(vehicleName(vehicleClass))} &nbsp;&middot;&nbsp; ${passengers} pax${luggage != null ? ` &nbsp;&middot;&nbsp; ${luggage} bags` : ""}</span>
          </td>
        </tr>
${flightNumber ? `
        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6; vertical-align:top;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#9a9a9a; text-transform:uppercase;">Flight</span>
          </td>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:14px; color:#1a1a1a; font-weight:bold;">${esc(flightNumber)}</span>
          </td>
        </tr>` : ""}
${extrasLine ? `
        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6; vertical-align:top;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#9a9a9a; text-transform:uppercase;">Extras</span>
          </td>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:14px; color:#1a1a1a; font-weight:bold;">${extrasLine}</span>
          </td>
        </tr>` : ""}
${meta.tipAmount > 0 ? `
        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6; vertical-align:top;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#9a9a9a; text-transform:uppercase;">Driver tip</span>
          </td>
          <td style="padding:14px 0; border-bottom:1px solid #e9e3d6;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:14px; color:#b39159; font-weight:bold;">&euro;${meta.tipAmount.toFixed(2)}</span>
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:12px; color:#8a8a8a;"> &middot; included in the total</span>
          </td>
        </tr>` : ""}

        <tr>
          <td style="padding:14px 0; vertical-align:top;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#9a9a9a; text-transform:uppercase;">Notes</span>
          </td>
          <td style="padding:14px 0;">
            <span style="font-family:Helvetica,Arial,sans-serif; font-size:14px; line-height:21px; color:#5c5c5c;">${notes}</span>
          </td>
        </tr>

      </table>
    </td></tr>

    <tr><td style="background-color:#faf8f4; padding:16px 48px 44px 48px; text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center">
        <tr><td style="background-color:#141414; border-radius:2px;">
          <a href="${SITE_URL}/admin/bookings" style="display:inline-block; padding:15px 38px; font-family:Helvetica,Arial,sans-serif; font-size:13px; letter-spacing:2px; color:#c9a96e; text-decoration:none; text-transform:uppercase;">
            Assign Driver
          </a>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="background-color:#141414; padding:24px 48px; text-align:center;">
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#5c5c5c;">
        INTERNAL NOTIFICATION &middot; ELITE BCN OPERATIONS &middot; ${esc(date)}
      </div>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Welcome Email Template ─────────────────────────────────
function welcomeHtml({
  firstName, email, password, unsubUrl,
}: {
  firstName: string; email: string; password: string; unsubUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Welcome — Elite BCN</title>
</head>
<body style="margin:0; padding:0; background-color:#efece5; -webkit-text-size-adjust:100%;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">Welcome to Elite BCN — your luxury chauffeur service in Barcelona.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#efece5;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%;">
    <tr><td style="background-color:#141414; padding:36px 40px 32px 40px; text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:26px; letter-spacing:8px; color:#ffffff;">ELITE<span style="color:#c9a96e;">BCN</span></div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:4px; color:#8a8a8a; padding-top:10px;">LUXURY TRANSFERS &nbsp;·&nbsp; BARCELONA</div>
    </td></tr>
    <tr><td style="height:3px; background-color:#c9a96e; font-size:0; line-height:0;">&nbsp;</td></tr>
    <tr><td style="background-color:#faf8f4; padding:48px 48px 24px 48px;">
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:4px; color:#b39159; text-transform:uppercase;">Welcome Aboard</div>
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:30px; line-height:38px; color:#1a1a1a; padding-top:14px;">The keys are yours,<br>${esc(firstName)}.</div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:14px; line-height:23px; color:#5c5c5c; padding-top:16px;">Your Elite BCN account is ready. From El Prat Airport to your hotel, from Montserrat to Sitges — a professional chauffeur is one tap away.</div>
    </td></tr>
    <tr><td style="background-color:#faf8f4; padding:0 48px 28px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0d8c8; border-radius:2px;">
        <tr><td style="padding:20px 24px 12px 24px;">
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:#1a1a1a;"><span style="color:#b39159; margin-right:8px;">✦</span><strong>Professional licensed chauffeurs</strong></div>
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:12px; color:#8a8a8a; padding-top:3px; padding-left:20px;">VTC-certified, background-checked, always in uniform</div>
        </td></tr>
        <tr><td style="padding:0 24px 12px 24px;">
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:#1a1a1a;"><span style="color:#b39159; margin-right:8px;">✦</span><strong>Fixed prices, no surprises</strong></div>
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:12px; color:#8a8a8a; padding-top:3px; padding-left:20px;">Your price is locked at booking — no meter, no surge pricing</div>
        </td></tr>
        <tr><td style="padding:0 24px 12px 24px;">
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:#1a1a1a;"><span style="color:#b39159; margin-right:8px;">✦</span><strong>Free cancellation 24h before pickup</strong></div>
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:12px; color:#8a8a8a; padding-top:3px; padding-left:20px;">Plans change — cancel anytime up to 24 hours before departure</div>
        </td></tr>
        <tr><td style="padding:0 24px 20px 24px;">
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:#1a1a1a;"><span style="color:#b39159; margin-right:8px;">✦</span><strong>Flight tracking &amp; meet &amp; greet</strong></div>
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:12px; color:#8a8a8a; padding-top:3px; padding-left:20px;">We monitor your flight and wait at arrivals with your name board</div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="background-color:#faf8f4; padding:0 48px 32px 48px;">
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:3px; color:#9a9a9a; text-transform:uppercase; margin-bottom:12px;">Your Login Details</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0ede6; border:1px solid #e0d8c8; border-radius:2px;">
        <tr><td style="padding:14px 20px; border-bottom:1px solid #e0d8c8;">
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#9a9a9a; text-transform:uppercase; letter-spacing:2px;">Email</div>
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:14px; color:#1a1a1a; padding-top:4px;">${esc(email)}</div>
        </td></tr>
        <tr><td style="padding:14px 20px;">
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#9a9a9a; text-transform:uppercase; letter-spacing:2px;">Temporary Password</div>
          <div style="font-family:Georgia,'Times New Roman',serif; font-size:18px; letter-spacing:4px; color:#b39159; padding-top:4px;">${esc(password)}</div>
        </td></tr>
      </table>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:11px; color:#9a9a9a; padding-top:10px;">Change your password after your first login at <a href="${SITE_URL}/auth/login" style="color:#b39159; text-decoration:none;">elitebcn.info</a></div>
    </td></tr>
    <tr><td style="background-color:#faf8f4; padding:0 48px 48px 48px; text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center">
        <tr><td style="background-color:#b39159; border-radius:2px;">
          <a href="${SITE_URL}/book" style="display:inline-block; padding:15px 38px; font-family:Helvetica,Arial,sans-serif; font-size:13px; letter-spacing:2px; color:#ffffff; text-decoration:none; text-transform:uppercase;">Book Your First Transfer</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="background-color:#141414; padding:32px 48px; text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:15px; letter-spacing:5px; color:#ffffff;">ELITE<span style="color:#c9a96e;">BCN</span></div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:11px; line-height:19px; color:#8a8a8a; padding-top:14px;">+34 635 383 712 &nbsp;·&nbsp; www.elitebcn.info<br>Licensed VTC Operator — Barcelona, Spain</div>
      ${unsubUrl ? `<div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#4a4a4a; padding-top:14px;"><a href="${unsubUrl}" style="color:#4a4a4a; text-decoration:underline;">Unsubscribe</a></div>` : ""}
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#5c5c5c; padding-top:8px;">&copy; ${new Date().getFullYear()} Elite BCN Transfers. All rights reserved.</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Abandoned Booking Email Template ────────────────────────
function abandonedBookingHtml({
  firstName, pickupShort, dropoffShort, date, time, quoteAmount, resumeUrl, unsubUrl,
}: {
  firstName: string; pickupShort: string; dropoffShort: string;
  date: string; time: string; quoteAmount: number; resumeUrl: string; unsubUrl?: string;
}): string {
  const waLink = "https://wa.me/34635383712?text=I%20need%20help%20with%20my%20Barcelona%20transfer";
  const priceStr = quoteAmount > 0 ? `€${quoteAmount.toFixed(2)}` : "Quote saved";
  const fromTo = dropoffShort
    ? `${esc(pickupShort)} → ${esc(dropoffShort)}`
    : esc(pickupShort);
  const dateTime = time ? `${esc(date)} &nbsp;&middot;&nbsp; ${esc(time)}` : esc(date);

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Your booking is waiting — Elite BCN</title>
</head>
<body style="margin:0; padding:0; background-color:#efece5; -webkit-text-size-adjust:100%;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">Your luxury transfer is saved — complete your booking in one click.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#efece5;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%;">
    <tr><td style="background-color:#141414; padding:36px 40px 32px 40px; text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:26px; letter-spacing:8px; color:#ffffff;">ELITE<span style="color:#c9a96e;">BCN</span></div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:4px; color:#8a8a8a; padding-top:10px;">LUXURY TRANSFERS &nbsp;·&nbsp; BARCELONA</div>
    </td></tr>
    <tr><td style="height:3px; background-color:#c9a96e; font-size:0; line-height:0;">&nbsp;</td></tr>
    <tr><td style="background-color:#faf8f4; padding:48px 48px 16px 48px;">
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:4px; color:#b39159; text-transform:uppercase;">Saved Transfer</div>
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:28px; line-height:36px; color:#1a1a1a; padding-top:14px;">Your chauffeur is still<br>holding the door, ${esc(firstName)}.</div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:14px; line-height:23px; color:#5c5c5c; padding-top:16px;">You were one step away from your luxury transfer. We've saved your quote — complete your booking before it expires.</div>
    </td></tr>
    <tr><td style="background-color:#faf8f4; padding:20px 48px 8px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#141414; border-radius:2px;">
        <tr><td colspan="2" style="padding:18px 24px 6px 24px;">
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:4px; color:#8a8a8a; text-transform:uppercase;">Your Saved Quote</div>
        </td></tr>
        <tr><td colspan="2" style="padding:4px 24px 4px 24px;">
          <div style="border-top:1px solid #2a2a2a; font-size:0; line-height:0;">&nbsp;</div>
        </td></tr>
        <tr>
          <td style="padding:8px 12px 4px 24px; vertical-align:top; width:55%;">
            <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#7a7a7a; text-transform:uppercase;">Route</div>
            <div style="font-family:Helvetica,Arial,sans-serif; font-size:13px; line-height:20px; color:#ffffff; padding-top:4px;">${fromTo}</div>
          </td>
          <td style="padding:8px 24px 4px 0; vertical-align:top;">
            <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#7a7a7a; text-transform:uppercase;">Date &amp; Time</div>
            <div style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:#ffffff; padding-top:4px;">${dateTime}</div>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:16px 24px 0 24px;">
          <div style="border-top:1px solid #2a2a2a; font-size:0; line-height:0;">&nbsp;</div>
        </td></tr>
        <tr><td colspan="2" style="padding:14px 24px 22px 24px;">
          <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#7a7a7a; text-transform:uppercase;">Fixed Price</div>
          <div style="font-family:Georgia,'Times New Roman',serif; font-size:28px; color:#c9a96e; padding-top:6px;">${priceStr}</div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="background-color:#faf8f4; padding:24px 48px 16px 48px; text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center">
        <tr><td style="background-color:#b39159; border-radius:2px;">
          <a href="${esc(resumeUrl)}" style="display:inline-block; padding:16px 42px; font-family:Helvetica,Arial,sans-serif; font-size:13px; letter-spacing:2px; color:#ffffff; text-decoration:none; text-transform:uppercase;">Complete My Booking</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="background-color:#faf8f4; padding:8px 48px 24px 48px; text-align:center;">
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:12px; line-height:20px; color:#8a8a8a;">✦ No charge until confirmed &nbsp;&nbsp; ✦ Free cancellation 24h &nbsp;&nbsp; ✦ 24/7 support</div>
    </td></tr>
    <tr><td style="background-color:#faf8f4; padding:0 48px 40px 48px; text-align:center;">
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:#5c5c5c; margin-bottom:14px;">Need help? We're available 24/7.</div>
      <table role="presentation" cellpadding="0" cellspacing="0" align="center">
        <tr><td style="background-color:#25D366; border-radius:2px;">
          <a href="${waLink}" style="display:inline-block; padding:12px 28px; font-family:Helvetica,Arial,sans-serif; font-size:13px; color:#ffffff; text-decoration:none;">Chat on WhatsApp</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="background-color:#141414; padding:32px 48px; text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:15px; letter-spacing:5px; color:#ffffff;">ELITE<span style="color:#c9a96e;">BCN</span></div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:11px; line-height:19px; color:#8a8a8a; padding-top:14px;">+34 635 383 712 &nbsp;·&nbsp; www.elitebcn.info<br>Licensed VTC Operator — Barcelona, Spain</div>
      ${unsubUrl ? `<div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#4a4a4a; padding-top:14px;"><a href="${unsubUrl}" style="color:#4a4a4a; text-decoration:underline;">Unsubscribe</a></div>` : ""}
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#5c5c5c; padding-top:8px;">&copy; ${new Date().getFullYear()} Elite BCN Transfers. All rights reserved.</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Newsletter Issue Template ────────────────────────────────
export function newsletterIssueHtml({
  issueTeaser, issueMonth, issueYear, issueNumber,
  leadHeadline, leadBody, leadLink,
  tipHeadline, tipBody,
  eventHeadline, eventBody,
  offerHeadline, offerBody, offerLink, offerCta,
  unsubUrl,
}: {
  issueTeaser: string; issueMonth: string; issueYear: string; issueNumber: string;
  leadHeadline: string; leadBody: string; leadLink?: string;
  tipHeadline: string; tipBody: string;
  eventHeadline: string; eventBody: string;
  offerHeadline: string; offerBody: string; offerLink: string; offerCta: string;
  unsubUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>The Barcelona Travel Insider — Elite BCN</title>
</head>
<body style="margin:0; padding:0; background-color:#efece5; -webkit-text-size-adjust:100%;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${esc(issueTeaser)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#efece5;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%;">

    <!-- Masthead -->
    <tr><td style="background-color:#141414; padding:36px 40px 24px 40px; text-align:center;">
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:5px; color:#8a8a8a; text-transform:uppercase; margin-bottom:14px;">Elite BCN Presents</div>
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:22px; letter-spacing:3px; color:#ffffff;">The Barcelona Travel Insider</div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:4px; color:#c9a96e; padding-top:10px; text-transform:uppercase;">${esc(issueMonth)} ${esc(issueYear)} &nbsp;·&nbsp; Issue No. ${esc(issueNumber)}</div>
    </td></tr>
    <tr><td style="height:3px; background-color:#c9a96e; font-size:0; line-height:0;">&nbsp;</td></tr>

    <!-- Lead Story -->
    <tr><td style="background-color:#faf8f4; padding:40px 48px 24px 48px;">
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:4px; color:#b39159; text-transform:uppercase; margin-bottom:14px;">Lead Story</div>
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:24px; line-height:32px; color:#1a1a1a; margin-bottom:16px;">${esc(leadHeadline)}</div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:14px; line-height:23px; color:#5c5c5c;">${esc(leadBody)}</div>
      ${leadLink ? `<div style="margin-top:20px;"><a href="${esc(leadLink)}" style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:#b39159; text-decoration:none; letter-spacing:1px;">Read more &rarr;</a></div>` : ""}
    </td></tr>
    <tr><td style="background-color:#faf8f4; padding:0 48px 32px 48px;">
      <div style="border-top:1px solid #e9e3d6; font-size:0; line-height:0;">&nbsp;</div>
    </td></tr>

    <!-- Two-column: Insider Tip | What's On -->
    <tr><td style="background-color:#faf8f4; padding:0 48px 32px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top; width:50%; padding-right:16px; border-right:1px solid #e9e3d6;">
            <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:4px; color:#b39159; text-transform:uppercase; margin-bottom:12px;">Insider Tip</div>
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:16px; line-height:24px; color:#1a1a1a; margin-bottom:10px;">${esc(tipHeadline)}</div>
            <div style="font-family:Helvetica,Arial,sans-serif; font-size:13px; line-height:21px; color:#5c5c5c;">${esc(tipBody)}</div>
          </td>
          <td style="vertical-align:top; width:50%; padding-left:16px;">
            <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:4px; color:#b39159; text-transform:uppercase; margin-bottom:12px;">What's On</div>
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:16px; line-height:24px; color:#1a1a1a; margin-bottom:10px;">${esc(eventHeadline)}</div>
            <div style="font-family:Helvetica,Arial,sans-serif; font-size:13px; line-height:21px; color:#5c5c5c;">${esc(eventBody)}</div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Subscriber Privilege Offer -->
    <tr><td style="background-color:#141414; padding:36px 48px; text-align:center;">
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:4px; color:#c9a96e; text-transform:uppercase; margin-bottom:14px;">Subscriber Privilege</div>
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:20px; line-height:28px; color:#ffffff; margin-bottom:14px;">${esc(offerHeadline)}</div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:13px; line-height:21px; color:#9a9a9a; margin-bottom:24px;">${esc(offerBody)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" align="center">
        <tr><td style="background-color:#c9a96e; border-radius:2px;">
          <a href="${esc(offerLink)}" style="display:inline-block; padding:14px 36px; font-family:Helvetica,Arial,sans-serif; font-size:13px; letter-spacing:2px; color:#1a1a1a; text-decoration:none; text-transform:uppercase; font-weight:bold;">${esc(offerCta)}</a>
        </td></tr>
      </table>
    </td></tr>

    <!-- Sign-off -->
    <tr><td style="background-color:#faf8f4; padding:36px 48px; text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:16px; color:#1a1a1a; font-style:italic;">See you at arrivals,</div>
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:14px; color:#b39159; margin-top:8px;">The Elite BCN Team</div>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background-color:#141414; padding:28px 48px; text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:14px; letter-spacing:5px; color:#ffffff;">ELITE<span style="color:#c9a96e;">BCN</span></div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:11px; line-height:19px; color:#8a8a8a; padding-top:12px;">+34 635 383 712 &nbsp;·&nbsp; www.elitebcn.info</div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#4a4a4a; padding-top:12px;">
        <a href="${unsubUrl}" style="color:#4a4a4a; text-decoration:underline;">Unsubscribe</a>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <a href="${SITE_URL}/privacy" style="color:#4a4a4a; text-decoration:underline;">Privacy Policy</a>
      </div>
      <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#5c5c5c; padding-top:8px;">&copy; ${new Date().getFullYear()} Elite BCN Transfers. All rights reserved.</div>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Shared HTML Layout ─────────────────────────────────────
// ─── Booking Confirmation ────────────────────────────────────
export async function sendBookingConfirmation({
  to, name, confirmationCode, pickupAddress, dropoffAddress,
  pickupDatetime, vehicleClass, totalAmount, passengers,
  bookingId, returnLeg, payment,
}: {
  to: string; name: string; confirmationCode: string; pickupAddress: string;
  dropoffAddress: string; pickupDatetime: string; vehicleClass: string;
  totalAmount: number; passengers: number; bookingId?: string;
  /** How the fare is settled, on a booking the office made by hand. */
  payment?: { line: string; payUrl?: string; paid?: boolean };
  /** The second booking, when the customer booked a round trip. */
  returnLeg?: {
    confirmationCode: string;
    pickupDatetime: string;
    pickupAddress: string;
    dropoffAddress: string;
    totalAmount: number;
  };
}) {
  const { date, time } = splitDatetime(pickupDatetime);
  const back = returnLeg
    ? { ...returnLeg, ...splitDatetime(returnLeg.pickupDatetime) }
    : undefined;
  const html = emailDocument(
    bookingReceivedCard({
      firstName: name.split(" ")[0],
      confirmationCode,
      pickupAddress,
      dropoffAddress,
      date,
      time,
      vehicle: vehicleName(vehicleClass),
      passengers,
      totalAmount,
      returnLeg: back,
      payment,
    }),
    back
      ? `Both journeys are reserved — references ${confirmationCode} and ${back.confirmationCode}`
      : `Your transfer is reserved — reference ${confirmationCode}`,
  );

  const subject = back
    ? `Return booking received — ${confirmationCode} | Elite BCN`
    : `Booking received — ${confirmationCode} | Elite BCN`;
  const id = await sendEmail({ from: FROM, to, subject, html });
  await logEmail({ to, subject: `Booking received — ${confirmationCode}`, type: "CONFIRMATION", resendId: id, bookingId });
}

// ─── Admin Alert ─────────────────────────────────────────────
export async function sendAdminNewBookingAlert({
  confirmationCode, guestName, guestEmail, guestPhone, pickupAddress, dropoffAddress,
  pickupDatetime, vehicleClass, totalAmount, passengers, luggage, flightNumber, specialRequests,
}: {
  confirmationCode: string; guestName: string; guestEmail: string; guestPhone?: string;
  pickupAddress: string; dropoffAddress: string; pickupDatetime: string;
  vehicleClass: string; totalAmount: number; passengers?: number; luggage?: number;
  flightNumber?: string | null; specialRequests?: string | null;
}) {
  const html = adminNewBookingAlertHtml({
    confirmationCode,
    clientName:      guestName,
    clientEmail:     guestEmail,
    clientPhone:     guestPhone,
    pickupAddress,
    dropoffAddress,
    pickupDatetime,
    vehicleClass,
    passengers:      passengers ?? 1,
    luggage,
    flightNumber,
    totalAmount,
    specialRequests,
  });
  // Logged like every other email. This was the one send that recorded nothing,
  // so there was no way to tell from the admin whether a new-booking alert had
  // gone out — which is exactly the question asked when one appears to be
  // missing. A failure is recorded rather than swallowed.
  const subject = `New Booking — ${confirmationCode} · €${totalAmount.toFixed(2)}`;
  try {
    const id = await sendEmail({
      from:    FROM,
      to:      ADMIN_EMAIL,
      replyTo: guestEmail,
      subject,
      html,
    });
    await logEmail({ to: ADMIN_EMAIL, subject, type: "ADMIN_ALERT", resendId: id });
  } catch (err) {
    await logEmail({ to: ADMIN_EMAIL, subject, type: "ADMIN_ALERT", status: "FAILED" });
    throw err;
  }

  // WhatsApp only. The office has already been emailed a few lines above, so
  // the email fallback is off — with it on, one booking sent two identical
  // messages the moment WhatsApp was unconfigured, which it always has been.
  void notifyAdmin(
    `🚗 New Booking ${confirmationCode}\n${guestName} · €${totalAmount.toFixed(2)}\n${pickupAddress} → ${dropoffAddress}\n${pickupDatetime}`,
    { emailFallback: false },
  );
}

// ─── New Lead Alert (booking started, not yet paid) ──────────
/**
 * Sent the moment someone finishes the contact step of the booking form.
 *
 * The abandoned-booking email is a daily job, which is the right cadence for a
 * discount offer and far too slow for a lead: an airport transfer is usually
 * booked within the hour. This exists so the office can ring or message while
 * the customer is still deciding.
 *
 * Deliberately plain. It is an internal alert, read on a phone, and the only
 * things that matter are who to contact and what they were booking.
 */
export async function sendNewLeadAlert({
  name, email, phone, pickup, dropoff, when, passengers, sessionId,
}: {
  name: string; email: string; phone: string;
  pickup?: string | null; dropoff?: string | null; when?: string | null;
  passengers?: number | null; sessionId: string;
}) {
  const subject = `New lead — ${name} · ${phone}`;
  const wa = `https://wa.me/${phone.replace(/\D/g, "")}`;
  const html = emailDocument(
    newLeadCard({ name, email, phone, pickup, dropoff, when, passengers }),
    `Unpaid enquiry from ${name} — ${phone}`,
  );

  try {
    const id = await sendEmail({ from: FROM, to: ADMIN_EMAIL, replyTo: email, subject, html });
    await logEmail({ to: ADMIN_EMAIL, subject: `LEAD ${sessionId}`, type: "ADMIN_LEAD", resendId: id });
  } catch (err) {
    await logEmail({ to: ADMIN_EMAIL, subject: `LEAD ${sessionId}`, type: "ADMIN_LEAD", status: "FAILED" });
    throw err;
  }

  // WhatsApp only — the email above already told the office about this lead.
  void notifyAdmin(
    `\u{1F464} New lead — not paid yet\n${name}\n${phone}\n${pickup ?? ""} \u2192 ${dropoff ?? ""}\n${when ?? ""}`,
    { emailFallback: false },
  );
}

// ─── Welcome Email ───────────────────────────────────────────
export async function sendWelcomeEmail({
  to, name, password, confirmationCode, totalAmount,
}: {
  to: string; name: string; password: string; confirmationCode: string; totalAmount: number;
}) {
  const html = welcomeHtml({
    firstName: name.split(" ")[0],
    email:     to,
    password,
    unsubUrl:  `${SITE_URL}/contact`,
  });
  const id = await sendEmail({ from: FROM, to, subject: `Welcome to Elite BCN — Your Account is Ready`, html });
  await logEmail({ to, subject: `Welcome to Elite BCN`, type: "WELCOME", resendId: id });
}

// ─── Abandoned Booking Recovery ──────────────────────────────
export async function sendAbandonedBookingEmail({
  to, name, couponCode, expiresAt, formData,
}: {
  to: string; name: string; couponCode?: string; expiresAt?: Date; formData?: Record<string, unknown>;
}) {
  const fd = (formData ?? {}) as Record<string, unknown>;

  // Extract route details from formData (try multiple field name conventions)
  const rawPickup  = String(fd.pickupAddress  ?? fd.pickup  ?? "").trim();
  const rawDropoff = String(fd.dropoffAddress ?? fd.dropoff ?? "").trim();
  const pickupShort  = rawPickup.split(",")[0].trim()  || "your pickup";
  const dropoffShort = rawDropoff.split(",")[0].trim() || "";
  const date = String(fd.date ?? "");
  const time = String(fd.time ?? "");

  // Extract price (quote object or flat totalAmount)
  const quoteObj   = fd.quote as Record<string, number> | undefined;
  const quoteAmount = Number(quoteObj?.totalAmount ?? fd.totalAmount ?? 0);

  // Build resume URL — embed coupon so it auto-applies
  const params = new URLSearchParams();
  const urlFields = ["pickupAddress","dropoffAddress","date","time","passengers","vehicleClass","pickupLat","pickupLng","dropoffLat","dropoffLng"];
  for (const k of urlFields) {
    const v = fd[k];
    if (v != null) params.set(k, String(v));
  }
  if (couponCode) params.set("coupon", couponCode);
  const resumeUrl = `${SITE_URL}/book?${params.toString()}`;

  const html = abandonedBookingHtml({
    firstName:    name.split(" ")[0] || name,
    pickupShort,
    dropoffShort,
    date,
    time,
    quoteAmount,
    resumeUrl,
    unsubUrl: `${SITE_URL}/contact`,
  });

  const id = await sendEmail({ from: FROM, to, subject: `Your Elite BCN transfer is still waiting — complete your booking`, html });
  await logEmail({ to, subject: `Abandoned booking recovery`, type: "ABANDONED", resendId: id });
}

// ─── Pickup Reminder ─────────────────────────────────────────
export async function sendPickupReminder({
  to, name, confirmationCode, pickupAddress, pickupDatetime, vehicleClass, arrivalUrl,
}: {
  to: string; name: string; confirmationCode: string; pickupAddress: string;
  pickupDatetime: string; vehicleClass: string;
  /** Passenger arrival link. Passed for airport pick-ups only. */
  arrivalUrl?: string | null;
}) {
  const { date, time } = splitDatetime(pickupDatetime);
  const html = emailDocument(
    rideConfirmedCard({
      firstName: name.split(" ")[0],
      confirmationCode,
      pickupAddress,
      date,
      time,
      vehicle: vehicleName(vehicleClass),
      arrivalUrl,
    }),
    `Your transfer is tomorrow — reference ${confirmationCode}`,
  );

  const id = await sendEmail({ from: FROM, to, subject: `Your transfer is tomorrow — ${confirmationCode} | Elite BCN`, html });
  await logEmail({ to, subject: `Pickup reminder`, type: "REMINDER", resendId: id });
}

// ─── Driver Assigned ─────────────────────────────────────────
export async function sendDriverAssignedEmail({
  to, name, confirmationCode, driverName, driverPhone,
  vehicleMake, vehicleModel, licensePlate, pickupDatetime,
}: {
  to: string; name: string; confirmationCode: string; driverName: string;
  driverPhone: string; vehicleMake: string; vehicleModel: string;
  licensePlate: string; pickupDatetime: string;
}) {
  const html = emailDocument(
    driverAssignedCard({
      firstName: name.split(" ")[0],
      confirmationCode,
      driverName,
      driverPhone,
      vehicle: `${vehicleMake} ${vehicleModel}`,
      licensePlate,
      pickupDatetime,
    }),
    `Your chauffeur is confirmed — reference ${confirmationCode}`,
  );

  const id = await sendEmail({ from: FROM, to, subject: `Your chauffeur is confirmed — ${confirmationCode} | Elite BCN`, html });
  await logEmail({ to, subject: `Driver assigned`, type: "DRIVER_ASSIGNED", resendId: id });
}

// ─── Review Request ──────────────────────────────────────────
export async function sendReviewRequestEmail({
  to, name, confirmationCode, bookingId,
}: {
  to: string; name: string; confirmationCode: string; bookingId: string;
}) {
  const reviewUrl = `${SITE_URL}/review?booking=${bookingId}`;
  const html = emailDocument(
    rideCompleteCard({
      firstName: name.split(" ")[0],
      confirmationCode,
      reviewUrl,
    }),
    `How was your journey? — reference ${confirmationCode}`,
  );

  const id = await sendEmail({ from: FROM, to, subject: `How was your Elite BCN experience? — ${confirmationCode}`, html });
  await logEmail({ to, subject: `Review request`, type: "REVIEW", resendId: id });
}

// ─── Payment Confirmation (Receipt) ──────────────────────────
export async function sendPaymentConfirmationEmail({
  to, name, confirmationCode, pickupAddress, dropoffAddress,
  pickupDatetime, vehicleClass, totalAmount, passengers, bookingId,
}: {
  to: string; name: string; confirmationCode: string; pickupAddress: string;
  dropoffAddress: string | null; pickupDatetime: string; vehicleClass: string;
  totalAmount: number; passengers: number; bookingId: string; transactionId?: string;
}) {
  const { date, time } = splitDatetime(pickupDatetime);
  const html = emailDocument(
    paymentReceiptCard({
      firstName: name.split(" ")[0],
      confirmationCode,
      pickupAddress,
      dropoffAddress: dropoffAddress ?? "—",
      date,
      time,
      vehicle: vehicleName(vehicleClass),
      passengers,
      totalAmount,
    }),
    `Payment received — reference ${confirmationCode}`,
  );
  const id = await sendEmail({ from: FROM, to, subject: `Booking confirmed — ${confirmationCode} | Elite BCN`, html });
  await logEmail({ to, subject: `Payment Confirmed — ${confirmationCode}`, type: "PAYMENT_CONFIRMATION", resendId: id, bookingId });
}

// ─── Failed Payment ───────────────────────────────────────────
export async function sendFailedPaymentEmail({
  to, name, confirmationCode, bookingId,
}: {
  to: string; name: string; confirmationCode: string; bookingId: string;
}) {
  const retryUrl = `${SITE_URL}/booking/pay?booking_id=${bookingId}`;
  const html = emailDocument(
    paymentFailedCard({ firstName: firstNameOf(name), confirmationCode, retryUrl }),
    `Payment for ${confirmationCode} did not go through — nothing has been charged. Retry to confirm your transfer.`,
  );
  const id = await sendEmail({ from: FROM, to, subject: `Payment unsuccessful — ${confirmationCode} | Elite BCN`, html });
  await logEmail({ to, subject: `Payment failed — ${confirmationCode}`, type: "PAYMENT_FAILED", resendId: id, bookingId });
}

// ─── Booking Cancelled ────────────────────────────────────────
export async function sendBookingCancelledEmail({
  to, name, confirmationCode, pickupDatetime, totalAmount,
}: {
  to: string; name: string; confirmationCode: string; pickupDatetime: string; totalAmount: number;
}) {
  const html = emailDocument(
    bookingCancelledCard({ firstName: firstNameOf(name), confirmationCode, pickupDatetime, totalAmount, refund: "pending" }),
    `Booking ${confirmationCode} has been cancelled.`,
  );
  const id = await sendEmail({ from: FROM, to, subject: `Booking cancelled — ${confirmationCode} | Elite BCN`, html });
  await logEmail({ to, subject: `Booking cancelled — ${confirmationCode}`, type: "CANCELLED", resendId: id });
}

// ─── Driver Booking Details ───────────────────────────────────
export async function sendDriverBookingDetailsEmail({
  to, driverName, confirmationCode, guestName, guestPhone,
  pickupAddress, dropoffAddress, pickupDatetime, vehicleClass,
  passengers, luggage, flightNumber, specialRequests, driverAmount,
}: {
  to: string; driverName: string; confirmationCode: string; guestName: string;
  guestPhone: string; pickupAddress: string; dropoffAddress: string | null;
  pickupDatetime: string; vehicleClass: string; passengers: number; luggage: number;
  flightNumber?: string | null; specialRequests?: string | null; driverAmount?: number | null;
}) {
  // The driver is the one who has to bring the child seat, so the extras go in
  // a row of their own rather than being stripped out with the metadata block.
  const driverMeta = parseBookingMeta(specialRequests);
  const html = emailDocument(
    driverJobCard({
      driverName, confirmationCode, guestName, guestPhone,
      pickupAddress, dropoffAddress, pickupDatetime,
      vehicle: vehicleName(vehicleClass),
      passengers, luggage, flightNumber,
      extras: driverMeta.extras.length ? formatExtras(driverMeta.extras) : null,
      tipAmount: driverMeta.tipAmount,
      notes: driverMeta.notes,
      driverAmount,
    }),
    `${confirmationCode} · ${pickupDatetime} · ${pickupAddress}`,
  );
  const id = await sendEmail({ from: FROM, to, subject: `New job — ${confirmationCode} · ${pickupDatetime} | Elite BCN`, html });
  await logEmail({ to, subject: `Driver booking assigned — ${confirmationCode}`, type: "DRIVER_BOOKING", resendId: id });
}

// ─── Newsletter Issue (structured) ──────────────────────────
export async function sendNewsletterIssue({
  to, subject, campaignId, unsubToken, ...templateParams
}: {
  to: string; subject: string; campaignId: string; unsubToken: string;
  issueTeaser: string; issueMonth: string; issueYear: string; issueNumber: string;
  leadHeadline: string; leadBody: string; leadLink?: string;
  tipHeadline: string; tipBody: string;
  eventHeadline: string; eventBody: string;
  offerHeadline: string; offerBody: string; offerLink: string; offerCta: string;
}) {
  const unsubUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=${unsubToken}`;
  const html = newsletterIssueHtml({ ...templateParams, unsubUrl });
  const id = await sendEmail({ from: FROM, to, subject, html });
  await logEmail({ to, subject, type: "NEWSLETTER", status: id ? "SENT" : "FAILED", resendId: id, campaignId });
  return { data: { id }, error: null };
}

// ─── Cancellation emails ─────────────────────────────────────
export async function sendCancellationEmail({
  to, name, confirmationCode, refundProcessed, totalAmount,
}: {
  to: string; name: string; confirmationCode: string; refundProcessed: boolean; totalAmount: number;
}) {
  const html = emailDocument(
    bookingCancelledCard({ firstName: firstNameOf(name), confirmationCode, totalAmount, refund: refundProcessed ? "processed" : "none" }),
    `Booking ${confirmationCode} has been cancelled.`,
  );
  const id = await sendEmail({ from: FROM, to, subject: `Booking cancelled — ${confirmationCode} | Elite BCN`, html });
  await logEmail({ to, subject: `Booking cancelled — ${confirmationCode}`, type: "CANCELLED", resendId: id });
}

export async function sendAdminCancellationAlert({
  confirmationCode, guestName, guestEmail, totalAmount, refundProcessed, pickupDatetime, pickupAddress,
}: {
  confirmationCode: string; guestName: string; guestEmail: string;
  totalAmount: number; refundProcessed: boolean;
  pickupDatetime: string; pickupAddress: string;
}) {
  const html = emailDocument(
    adminCancellationCard({ confirmationCode, guestName, guestEmail, totalAmount, refundProcessed, pickupDatetime, pickupAddress }),
    `${guestName} cancelled ${confirmationCode} (${pickupDatetime}) — refund ${refundProcessed ? "processed" : "not issued"}.`,
  );
  await sendEmail({ from: FROM, to: ADMIN_EMAIL, subject: `Cancelled — ${confirmationCode} · ${pickupDatetime}`, html });
}

// ─── Pickup changed emails ────────────────────────────────────
export async function sendPickupChangedEmail({
  to, name, confirmationCode, newPickupAddress, pickupDatetime,
}: {
  to: string; name: string; confirmationCode: string;
  newPickupAddress: string; pickupDatetime: string;
}) {
  const html = emailDocument(
    pickupChangedCard({ firstName: firstNameOf(name), confirmationCode, newPickupAddress, pickupDatetime }),
    `Pick-up for ${confirmationCode} is now ${newPickupAddress}.`,
  );
  const id = await sendEmail({ from: FROM, to, subject: `Pick-up updated — ${confirmationCode} | Elite BCN`, html });
  await logEmail({ to, subject: `Pickup changed — ${confirmationCode}`, type: "PICKUP_CHANGED", resendId: id });
}

export async function sendAdminPickupChangedAlert({
  confirmationCode, guestName, guestEmail, oldPickupAddress, newPickupAddress, pickupDatetime,
}: {
  confirmationCode: string; guestName: string; guestEmail: string;
  oldPickupAddress: string; newPickupAddress: string; pickupDatetime: string;
}) {
  const html = emailDocument(
    adminPickupChangedCard({ confirmationCode, guestName, guestEmail, oldPickupAddress, newPickupAddress, pickupDatetime }),
    `${guestName} moved pick-up for ${confirmationCode} to ${newPickupAddress}.`,
  );
  await sendEmail({ from: FROM, to: ADMIN_EMAIL, subject: `Pick-up changed — ${confirmationCode} · ${pickupDatetime}`, html });
}

// ─── Newsletter Campaign ─────────────────────────────────────
export async function sendNewsletterCampaign({
  to, subject, htmlBody, campaignId, unsubToken,
}: {
  to: string; subject: string; htmlBody: string; campaignId: string; unsubToken: string;
}) {
  const unsubUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=${unsubToken}`;
  const fullHtml = htmlBody.replace("{{UNSUB_URL}}", unsubUrl);

  const id = await sendEmail({ from: FROM, to, subject, html: fullHtml });
  await logEmail({ to, subject, type: "NEWSLETTER", status: id ? "SENT" : "FAILED", resendId: id, campaignId });
  return { data: { id }, error: null };
}

// ─── Temporary Password ──────────────────────────────────────────────
/**
 * Sends someone a temporary password for their portal.
 *
 * Used both for drivers who never received credentials and for anyone who has
 * lost theirs. The account is flagged mustChangePassword, so the middleware
 * forces a change at the next sign-in and this password stops working the
 * moment they choose their own.
 */
export async function sendTemporaryPassword({
  to, name, password, portal,
}: {
  to: string;
  name: string;
  password: string;
  /** Which portal to point them at — drivers, partners and customers land in different places. */
  portal: "driver" | "customer" | "partner";
}) {
  const firstName   = name.split(" ")[0] || "there";
  const loginUrl    = `${SITE_URL}/auth/login`;
  const portalLabel = portal === "driver" ? "driver portal" : portal === "partner" ? "fleet partner panel" : "account";

  const html = emailDocument(
    credentialsCard({ firstName, email: to, password, portalLabel, loginUrl }),
    "Your Elite BCN sign-in details — choose your own password at first sign-in.",
  );

  const id = await sendEmail({ from: FROM, to, subject: "Your Elite BCN sign-in details", html });
  await logEmail({ to, subject: "Your Elite BCN sign-in details", type: "TEMP_PASSWORD", resendId: id });
}

// ─── Fleet partners ──────────────────────────────────────────

/** A job sent to a partner company, with the payout the office set for it. */
export async function sendPartnerJobEmail({
  to, contactName, companyName, confirmationCode, pickupAddress, dropoffAddress,
  pickupDatetime, vehicleClass, passengers, luggage, flightNumber, payout, panelUrl,
}: {
  to: string; contactName: string; companyName: string; confirmationCode: string;
  pickupAddress: string; dropoffAddress?: string | null; pickupDatetime: string;
  vehicleClass: string; passengers: number; luggage: number; flightNumber?: string | null;
  payout: number; panelUrl: string;
}) {
  const html = emailDocument(
    partnerJobCard({
      contactName, companyName, confirmationCode, pickupAddress, dropoffAddress, pickupDatetime,
      vehicle: vehicleName(vehicleClass), passengers, luggage, flightNumber, payout, panelUrl,
    }),
    `New job ${confirmationCode} · ${pickupDatetime} · payout €${payout.toFixed(2)}`,
  );
  const id = await sendEmail({ from: FROM, to, subject: `New job — ${confirmationCode} · ${pickupDatetime} | Elite BCN`, html });
  await logEmail({ to, subject: `Partner job — ${confirmationCode}`, type: "PARTNER_JOB", resendId: id });
}

/** A customer account has become a company login; same password, new panel. */
export async function sendPartnerConvertedEmail({ to, contactName, companyName }: { to: string; contactName: string; companyName: string }) {
  const html = emailDocument(
    partnerConvertedCard({ contactName, companyName, panelUrl: `${SITE_URL}/partner` }),
    `${companyName} now has a fleet partner panel at Elite BCN. Sign in with your usual password.`,
  );
  const id = await sendEmail({ from: FROM, to, subject: `Your fleet partner panel is ready | Elite BCN`, html });
  await logEmail({ to, subject: "Fleet partner panel ready", type: "PARTNER_CONVERTED", resendId: id });
}

/** The office learns who a partner put on the job. */
export async function sendAdminPartnerDispatchAlert(o: {
  companyName: string; confirmationCode: string;
  pickupAddress: string; dropoffAddress?: string | null; pickupDatetime: string;
  driverName: string; driverEmail?: string | null; driverPhone: string;
  vehicleMake: string; vehicleModel: string; licensePlate: string;
  payout: number; driverAmount?: number | null;
}) {
  const html = emailDocument(
    adminPartnerDispatchCard(o),
    `${o.companyName} dispatched ${o.driverName} (${o.vehicleMake} ${o.vehicleModel}, ${o.licensePlate}) on ${o.confirmationCode}.`,
  );
  await sendEmail({ from: FROM, to: ADMIN_EMAIL, subject: `Partner dispatch — ${o.confirmationCode} · ${o.driverName}`, html });
}

// ─── Admin operational alert ─────────────────────────────────

/**
 * An operational alert to the office, by email.
 *
 * These alerts have always gone out over WhatsApp, and WhatsApp has never been
 * configured on this deployment — WA_PHONE_ID and WA_TOKEN are unset, so
 * notifyAdminWhatsApp returned at its first line and every alert it was given
 * was silently dropped. Flight delays, new leads and cancellations were all
 * being raised correctly and then thrown away.
 *
 * Email is the channel that demonstrably works here, so it is the fallback.
 * Deliberately plain: this is an operational alert read on a phone, and the
 * only things that matter are the subject line and the few lines under it.
 */
export async function sendAdminAlertEmail(subject: string, text: string): Promise<void> {
  const safe = esc(text).replace(/\n/g, "<br>");
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F0EFEC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0EFEC;">
  <tr><td align="center" style="padding:28px 14px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background-color:#FFFFFF;">
      <tr><td style="background-color:#202329;padding:20px 26px;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:5px;color:#FFFFFF;">ELITE<span style="color:#B68D4C;">BCN</span></div>
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#8E8E96;padding-top:7px;">Operations alert</div>
      </td></tr>
      <tr><td style="padding:26px;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:27px;color:#15151A;">${esc(subject)}</div>
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:23px;color:#4A4A52;padding-top:14px;">${safe}</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const id = await sendEmail({ from: FROM, to: ADMIN_EMAIL, subject: `[Ops] ${subject}`, html });
  await logEmail({ to: ADMIN_EMAIL, subject: `[Ops] ${subject}`, type: "ADMIN_ALERT", resendId: id });
}

// ─── Flight delay ────────────────────────────────────────────

/**
 * The delay, to the passenger.
 *
 * The sweep in lib/flights/sweep.ts detects the delay and calls notify(), whose
 * email channel only fires when the caller hands it a sender — which nothing
 * ever did. FLIGHT_DELAYED has listed "email" among its channels the whole
 * time and never sent one. This is that sender.
 */
export async function sendFlightDelayEmail({
  to, name, flight, when, confirmationCode, delayMinutes,
}: {
  to: string; name: string; flight: string; when: string;
  confirmationCode: string; delayMinutes?: number | null;
}) {
  const html = emailDocument(
    flightDelayCard({
      audience:         "customer",
      firstName:        name.split(" ")[0] || name,
      flight,
      when,
      confirmationCode,
      delayMinutes,
    }),
    `${flight} now lands ${when} — your chauffeur has been updated`,
  );
  const id = await sendEmail({
    from: FROM, to,
    subject: `Flight ${flight} delayed — new landing time ${when} | Elite BCN`,
    html,
  });
  await logEmail({ to, subject: `Flight delayed — ${confirmationCode}`, type: "FLIGHT_DELAY", resendId: id });
}

/** The same delay, to the driver, as an instruction rather than reassurance. */
export async function sendDriverFlightDelayEmail({
  to, driverName, flight, when, confirmationCode, passenger, pickupAddress, delayMinutes,
}: {
  to: string; driverName: string; flight: string; when: string;
  confirmationCode: string; passenger: string; pickupAddress: string;
  delayMinutes?: number | null;
}) {
  const html = emailDocument(
    flightDelayCard({
      audience:         "driver",
      firstName:        driverName.split(" ")[0] || driverName,
      flight,
      when,
      confirmationCode,
      delayMinutes,
      passenger,
      pickupAddress,
    }),
    `Pick-up moved — ${flight} now lands ${when}`,
  );
  const id = await sendEmail({
    from: FROM, to,
    subject: `Pick-up moved — ${flight} delayed | ${confirmationCode}`,
    html,
  });
  await logEmail({ to, subject: `Driver flight delay — ${confirmationCode}`, type: "FLIGHT_DELAY_DRIVER", resendId: id });
}