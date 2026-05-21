import { Resend } from "resend";
import { logEmail } from "@/lib/marketing";

let _resend: Resend | undefined;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}
export const resend = new Proxy({} as Resend, { get: (_, p) => (getResend() as any)[p as string] });

const FROM = "Élite BCN Transfers <noreply@elitebcntransfers.com>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "vtcbcn2025@gmail.com";
const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";

// ─── Shared HTML Layout ─────────────────────────────────────
function emailLayout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Élite BCN Transfers</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #f0ebe0; }
  .wrapper { max-width: 620px; margin: 0 auto; background: #0a0a0a; }
  .header { background: linear-gradient(135deg,#0a0a0a 0%,#1a1600 100%); padding: 36px 40px 28px; text-align: center; border-bottom: 1px solid #c9a84c; }
  .logo-mark { display: inline-flex; align-items: center; gap: 10px; }
  .logo-diamond { width: 28px; height: 28px; border: 1.5px solid #c9a84c; transform: rotate(45deg); display: inline-flex; align-items: center; justify-content: center; }
  .logo-inner { width: 10px; height: 10px; background: #c9a84c; }
  .logo-text { font-size: 22px; letter-spacing: 6px; font-weight: 300; color: #fff; }
  .logo-text span { color: #c9a84c; }
  .tagline { color: #888; font-size: 11px; letter-spacing: 3px; margin-top: 8px; text-transform: uppercase; }
  .body { padding: 36px 40px; color: #d0d0d0; font-size: 15px; line-height: 1.7; }
  h2 { color: #c9a84c; font-size: 22px; margin-bottom: 10px; font-weight: 400; }
  .divider { height: 1px; background: #1e1e1e; margin: 24px 0; }
  .code-box { background: #0f0f0f; border: 1px solid #c9a84c; border-radius: 10px; padding: 24px; text-align: center; margin: 28px 0; }
  .code { color: #c9a84c; font-size: 30px; letter-spacing: 8px; font-family: 'Courier New', monospace; font-weight: bold; }
  .detail-table { width: 100%; border-collapse: collapse; }
  .detail-table td { padding: 10px 0; border-bottom: 1px solid #1a1a1a; font-size: 14px; }
  .detail-table td:first-child { color: #888; width: 38%; }
  .detail-table td:last-child { color: #fff; text-align: right; }
  .coupon-box { background: linear-gradient(135deg,#1a1200,#0f0f00); border: 1.5px solid #c9a84c; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0; }
  .coupon-pct { font-size: 48px; color: #c9a84c; font-weight: bold; line-height: 1; }
  .coupon-code-label { font-size: 11px; letter-spacing: 3px; color: #888; text-transform: uppercase; margin: 12px 0 6px; }
  .coupon-code { font-size: 22px; letter-spacing: 6px; font-family: 'Courier New', monospace; color: #fff; background: #0a0a0a; border: 1px dashed #c9a84c; padding: 10px 20px; display: inline-block; border-radius: 6px; margin-bottom: 10px; }
  .coupon-exp { font-size: 12px; color: #888; }
  .cta-btn { display: inline-block; background: #c9a84c; color: #000 !important; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: bold; letter-spacing: 1px; margin: 8px 0; }
  .wa-btn { display: inline-block; background: #25D366; color: #fff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; margin: 8px 0; }
  .outline-btn { display: inline-block; background: transparent; color: #c9a84c !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; border: 1px solid #c9a84c; margin: 8px 0; }
  .cred-box { background: #111; border: 1px solid #c9a84c; border-radius: 8px; padding: 20px; margin: 24px 0; }
  .cred-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e1e1e; font-size: 14px; }
  .cred-label { color: #888; }
  .cred-value { color: #fff; font-family: 'Courier New', monospace; }
  .footer { background: #050505; padding: 24px 40px; text-align: center; color: #555; font-size: 12px; border-top: 1px solid #1a1a1a; }
  .footer a { color: #888; text-decoration: none; }
  .total-row { display: flex; justify-content: space-between; padding: 16px 0 0; }
  .total-label { color: #c9a84c; font-size: 16px; }
  .total-value { color: #c9a84c; font-size: 24px; font-weight: bold; }
  @media (max-width: 480px) {
    .body { padding: 24px 20px; }
    .header { padding: 28px 20px 22px; }
    .code { font-size: 22px; letter-spacing: 4px; }
  }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo-mark">
      <div class="logo-diamond"><div class="logo-inner"></div></div>
      <div class="logo-text">ÉLITE<span>BCN</span></div>
    </div>
    <p class="tagline">Luxury Transfers · Barcelona</p>
  </div>
  <div class="body">${body}</div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Élite BCN Transfers · <a href="tel:+34635383712">+34 635 383 712</a> · <a href="mailto:vtcbcn2025@gmail.com">vtcbcn2025@gmail.com</a></p>
    <p style="margin-top:6px;">Barcelona, Spain · Licensed VTC Operator · <a href="${SITE_URL}/privacy">Privacy Policy</a> · <a href="${SITE_URL}/terms">Terms</a></p>
  </div>
</div>
</body>
</html>`;
}

// ─── Booking Confirmation ────────────────────────────────────
export async function sendBookingConfirmation({
  to, name, confirmationCode, pickupAddress, dropoffAddress,
  pickupDatetime, vehicleClass, totalAmount, passengers,
  bookingId,
}: {
  to: string; name: string; confirmationCode: string; pickupAddress: string;
  dropoffAddress: string; pickupDatetime: string; vehicleClass: string;
  totalAmount: number; passengers: number; bookingId?: string;
}) {
  const html = emailLayout(`
    <h2>Booking Confirmed</h2>
    <p>Dear ${name},</p>
    <p>Your luxury transfer has been confirmed. Your chauffeur will be assigned shortly and you'll receive a notification.</p>
    <div class="code-box">
      <p style="color:#888;font-size:11px;margin-bottom:8px;letter-spacing:3px;text-transform:uppercase;">Confirmation Code</p>
      <div class="code">${confirmationCode}</div>
    </div>
    <table class="detail-table">
      <tr><td>Pick-up</td><td>${pickupAddress}</td></tr>
      <tr><td>Drop-off</td><td>${dropoffAddress || "—"}</td></tr>
      <tr><td>Date & Time</td><td>${pickupDatetime}</td></tr>
      <tr><td>Vehicle</td><td>${vehicleClass.replace(/_/g, " ")}</td></tr>
      <tr><td>Passengers</td><td>${passengers}</td></tr>
    </table>
    <div class="total-row">
      <span class="total-label">Total Paid</span>
      <span class="total-value">€${totalAmount.toFixed(2)}</span>
    </div>
    <div class="divider"></div>
    <p style="color:#888;font-size:13px;">Need help or changes? Contact us anytime:</p>
    <div style="text-align:center;margin-top:16px;">
      <a href="https://wa.me/34635383712?text=Booking%20${confirmationCode}" class="wa-btn">💬 WhatsApp Support</a>
    </div>
  `);

  const result = await resend.emails.send({
    from: FROM, to,
    subject: `✓ Booking Confirmed — ${confirmationCode} | Élite BCN`,
    html,
  });
  await logEmail({ to, subject: `Booking Confirmed — ${confirmationCode}`, type: "CONFIRMATION", resendId: result?.data?.id, bookingId });
}

// ─── Admin Alert ─────────────────────────────────────────────
export async function sendAdminNewBookingAlert({
  confirmationCode, guestName, guestEmail, pickupAddress, dropoffAddress,
  pickupDatetime, vehicleClass, totalAmount,
}: {
  confirmationCode: string; guestName: string; guestEmail: string;
  pickupAddress: string; dropoffAddress: string; pickupDatetime: string;
  vehicleClass: string; totalAmount: number;
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `🚗 New Booking — ${confirmationCode}`,
    html: `<h2>New Booking Received</h2>
      <p><b>Code:</b> ${confirmationCode}</p>
      <p><b>Client:</b> ${guestName} (${guestEmail})</p>
      <p><b>Pickup:</b> ${pickupAddress}</p>
      <p><b>Dropoff:</b> ${dropoffAddress}</p>
      <p><b>DateTime:</b> ${pickupDatetime}</p>
      <p><b>Vehicle:</b> ${vehicleClass}</p>
      <p><b>Amount:</b> €${totalAmount}</p>
      <p><a href="${SITE_URL}/admin/bookings">View in Admin Panel</a></p>`,
  });
}

// ─── Welcome Email ───────────────────────────────────────────
export async function sendWelcomeEmail({
  to, name, password, confirmationCode, totalAmount,
}: {
  to: string; name: string; password: string; confirmationCode: string; totalAmount: number;
}) {
  const html = emailLayout(`
    <h2>Welcome, ${name}!</h2>
    <p>Your booking <strong style="color:#c9a84c;">${confirmationCode}</strong> for <strong>€${totalAmount.toFixed(2)}</strong> has been received.</p>
    <p style="margin-top:12px;">We've automatically created an account so you can track your booking, view driver details, and manage future rides.</p>
    <div class="cred-box">
      <p style="color:#888;font-size:11px;letter-spacing:3px;text-transform:uppercase;text-align:center;margin-bottom:14px;">Your Login Details</p>
      <div class="cred-row"><span class="cred-label">Email</span><span class="cred-value">${to}</span></div>
      <div class="cred-row" style="border:none;"><span class="cred-label">Password</span><span class="cred-value">${password}</span></div>
    </div>
    <p style="color:#888;font-size:13px;">You can change your password after logging in.</p>
    <div style="text-align:center;margin-top:20px;">
      <a href="${SITE_URL}/auth/login" class="cta-btn">View My Booking →</a>
    </div>
  `);

  const result = await resend.emails.send({
    from: FROM, to,
    subject: `Welcome to Élite BCN — Your Account & Booking ${confirmationCode}`,
    html,
  });
  await logEmail({ to, subject: `Welcome to Élite BCN`, type: "WELCOME", resendId: result?.data?.id });
}

// ─── Abandoned Booking Recovery ──────────────────────────────
export async function sendAbandonedBookingEmail({
  to, name, couponCode, expiresAt, formData,
}: {
  to: string; name: string; couponCode: string; expiresAt: Date; formData?: Record<string, unknown>;
}) {
  const hoursLeft = Math.round((expiresAt.getTime() - Date.now()) / 3600000);
  const bookUrl = formData
    ? `${SITE_URL}/book?${new URLSearchParams(Object.entries(formData).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])).toString()}`
    : `${SITE_URL}/book`;

  const html = emailLayout(`
    <h2>You Left Something Behind…</h2>
    <p>Hi ${name || "there"},</p>
    <p>You started booking a luxury transfer but didn't complete it. We saved your details — and we'd love to welcome you on board.</p>
    <p style="margin-top:12px;">As a special thank-you for your interest, here's an exclusive discount just for you:</p>
    <div class="coupon-box">
      <div class="coupon-pct">5%</div>
      <p style="color:#888;font-size:13px;margin-top:6px;">OFF YOUR BOOKING</p>
      <p class="coupon-code-label">Use code at checkout</p>
      <div class="coupon-code">${couponCode}</div>
      <p class="coupon-exp">⏱ Expires in ${hoursLeft} hours · One-time use · Your email only</p>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${bookUrl}" class="cta-btn" style="margin-right:8px;">Complete My Booking →</a>
    </div>
    <div class="divider"></div>
    <p style="color:#888;font-size:13px;">Questions? Our team is available 24/7:</p>
    <div style="text-align:center;margin-top:12px;">
      <a href="https://wa.me/34635383712" class="wa-btn">💬 Chat on WhatsApp</a>
    </div>
    <div class="divider"></div>
    <p style="font-size:12px;color:#555;">✓ Professional licensed chauffeurs &nbsp; ✓ Fixed prices, no surprises &nbsp; ✓ Free cancellation 24h before pickup</p>
  `);

  const result = await resend.emails.send({
    from: FROM, to,
    subject: `🚗 Complete your Barcelona transfer — 5% OFF inside`,
    html,
  });
  await logEmail({ to, subject: `Abandoned booking recovery`, type: "ABANDONED", resendId: result?.data?.id });
}

// ─── Pickup Reminder ─────────────────────────────────────────
export async function sendPickupReminder({
  to, name, confirmationCode, pickupAddress, pickupDatetime, vehicleClass,
}: {
  to: string; name: string; confirmationCode: string; pickupAddress: string;
  pickupDatetime: string; vehicleClass: string;
}) {
  const html = emailLayout(`
    <h2>Your Transfer is Tomorrow</h2>
    <p>Hi ${name},</p>
    <p>This is a friendly reminder that your luxury transfer is scheduled for <strong style="color:#c9a84c;">tomorrow</strong>.</p>
    <div class="code-box">
      <p style="color:#888;font-size:11px;margin-bottom:8px;letter-spacing:3px;text-transform:uppercase;">Booking Reference</p>
      <div class="code">${confirmationCode}</div>
    </div>
    <table class="detail-table">
      <tr><td>Pick-up</td><td>${pickupAddress}</td></tr>
      <tr><td>Date & Time</td><td>${pickupDatetime}</td></tr>
      <tr><td>Vehicle</td><td>${vehicleClass.replace(/_/g, " ")}</td></tr>
    </table>
    <div class="divider"></div>
    <p style="color:#c9a84c;font-size:14px;font-weight:bold;">💡 Tips for a smooth pickup:</p>
    <ul style="margin-top:10px;padding-left:20px;color:#aaa;font-size:14px;line-height:2;">
      <li>Your driver will contact you 30 minutes before pickup</li>
      <li>For airport pickups, your driver will be in arrivals holding a name board</li>
      <li>Save our WhatsApp in case you need to reach us</li>
    </ul>
    <div style="text-align:center;margin-top:20px;">
      <a href="https://wa.me/34635383712" class="wa-btn">💬 Contact Driver via WhatsApp</a>
    </div>
  `);

  const result = await resend.emails.send({
    from: FROM, to,
    subject: `📍 Reminder: Your Élite BCN Transfer Tomorrow — ${confirmationCode}`,
    html,
  });
  await logEmail({ to, subject: `Pickup reminder`, type: "REMINDER", resendId: result?.data?.id });
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
  const html = emailLayout(`
    <h2>Your Chauffeur is Assigned</h2>
    <p>Dear ${name},</p>
    <p>Great news! Your professional chauffeur has been confirmed for your upcoming journey.</p>
    <table class="detail-table" style="margin-top:20px;">
      <tr><td>Driver</td><td>${driverName}</td></tr>
      <tr><td>Phone</td><td>${driverPhone}</td></tr>
      <tr><td>Vehicle</td><td>${vehicleMake} ${vehicleModel}</td></tr>
      <tr><td>Plate</td><td>${licensePlate}</td></tr>
      <tr><td>Pickup</td><td>${pickupDatetime}</td></tr>
    </table>
    <div style="text-align:center;margin-top:24px;">
      <a href="tel:${driverPhone}" class="cta-btn">📞 Call Driver</a>
    </div>
    <div style="text-align:center;margin-top:10px;">
      <a href="https://wa.me/${driverPhone.replace(/\D/g, '')}" class="wa-btn">💬 WhatsApp Driver</a>
    </div>
  `);

  const result = await resend.emails.send({
    from: FROM, to,
    subject: `🚗 Driver Assigned — ${confirmationCode} | Élite BCN`,
    html,
  });
  await logEmail({ to, subject: `Driver assigned`, type: "DRIVER_ASSIGNED", resendId: result?.data?.id });
}

// ─── Review Request ──────────────────────────────────────────
export async function sendReviewRequestEmail({
  to, name, confirmationCode, bookingId,
}: {
  to: string; name: string; confirmationCode: string; bookingId: string;
}) {
  const reviewUrl = `${SITE_URL}/review?booking=${bookingId}`;
  const html = emailLayout(`
    <h2>How Was Your Journey?</h2>
    <p>Dear ${name},</p>
    <p>We hope your recent transfer with Élite BCN was exceptional. Your feedback helps us maintain our luxury standard of service.</p>
    <p style="margin-top:12px;">It only takes 30 seconds — how would you rate your experience?</p>
    <div style="text-align:center;margin:28px 0;">
      <div style="font-size:36px;letter-spacing:8px;">⭐⭐⭐⭐⭐</div>
      <div style="margin-top:16px;">
        <a href="${reviewUrl}?rating=5" class="cta-btn">Leave a Review →</a>
      </div>
    </div>
    <div class="divider"></div>
    <p style="color:#888;font-size:13px;text-align:center;">Booking reference: <strong style="color:#c9a84c;">${confirmationCode}</strong></p>
    <div style="text-align:center;margin-top:12px;">
      <a href="https://wa.me/34635383712" class="wa-btn">💬 Contact Us</a>
    </div>
  `);

  const result = await resend.emails.send({
    from: FROM, to,
    subject: `How was your Élite BCN experience? — ${confirmationCode}`,
    html,
  });
  await logEmail({ to, subject: `Review request`, type: "REVIEW", resendId: result?.data?.id });
}

// ─── Newsletter Campaign ─────────────────────────────────────
export async function sendNewsletterCampaign({
  to, subject, htmlBody, campaignId, unsubToken,
}: {
  to: string; subject: string; htmlBody: string; campaignId: string; unsubToken: string;
}) {
  const unsubUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=${unsubToken}`;
  const fullHtml = htmlBody.replace("{{UNSUB_URL}}", unsubUrl);

  const result = await resend.emails.send({
    from: FROM, to, subject, html: fullHtml,
  });
  await logEmail({ to, subject, type: "NEWSLETTER", status: result?.data?.id ? "SENT" : "FAILED", resendId: result?.data?.id, campaignId });
  return result;
}
