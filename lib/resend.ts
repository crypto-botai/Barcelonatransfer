import { Resend } from "resend";

let _resend: Resend | undefined;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}
export const resend = new Proxy({} as Resend, { get: (_, p) => (getResend() as any)[p as string] });

const FROM = "Élite BCN Transfers <noreply@elitebcntransfers.com>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "vtcbcn2025@gmail.com";

export async function sendBookingConfirmation({
  to,
  name,
  confirmationCode,
  pickupAddress,
  dropoffAddress,
  pickupDatetime,
  vehicleClass,
  totalAmount,
  passengers,
}: {
  to: string;
  name: string;
  confirmationCode: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  vehicleClass: string;
  totalAmount: number;
  passengers: number;
}) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Georgia, serif; background: #f5f0e8; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #0a0a0a; }
    .header { background: linear-gradient(135deg,#0a0a0a,#1a1a1a); padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #c9a84c; }
    .logo { color: #c9a84c; font-size: 28px; letter-spacing: 6px; font-weight: 300; }
    .logo span { color: #fff; }
    .body { padding: 40px; color: #e0e0e0; }
    h2 { color: #c9a84c; font-size: 22px; margin-bottom: 8px; }
    .code-box { background: #1a1a1a; border: 1px solid #c9a84c; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
    .code { color: #c9a84c; font-size: 28px; letter-spacing: 6px; font-family: monospace; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #222; }
    .label { color: #888; font-size: 13px; }
    .value { color: #fff; font-size: 14px; text-align: right; }
    .total-row { display: flex; justify-content: space-between; padding: 16px 0; }
    .total-label { color: #c9a84c; font-size: 16px; }
    .total-value { color: #c9a84c; font-size: 22px; font-weight: bold; }
    .footer { background: #050505; padding: 24px 40px; text-align: center; color: #555; font-size: 12px; border-top: 1px solid #1a1a1a; }
    .wa-btn { display: inline-block; background: #25D366; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">ÉLITE<span>BCN</span></div>
      <p style="color:#888;font-size:13px;margin-top:8px;letter-spacing:3px;">LUXURY TRANSFERS</p>
    </div>
    <div class="body">
      <h2>Booking Confirmed</h2>
      <p>Dear ${name},</p>
      <p>Your luxury transfer has been confirmed. Your chauffeur will be assigned shortly.</p>
      <div class="code-box">
        <p style="color:#888;font-size:12px;margin:0 0 8px;letter-spacing:2px;">CONFIRMATION CODE</p>
        <div class="code">${confirmationCode}</div>
      </div>
      <div style="background:#111;border-radius:8px;padding:20px;">
        <div class="detail-row">
          <span class="label">PICK-UP</span>
          <span class="value">${pickupAddress}</span>
        </div>
        <div class="detail-row">
          <span class="label">DROP-OFF</span>
          <span class="value">${dropoffAddress}</span>
        </div>
        <div class="detail-row">
          <span class="label">DATE & TIME</span>
          <span class="value">${pickupDatetime}</span>
        </div>
        <div class="detail-row">
          <span class="label">VEHICLE</span>
          <span class="value">${vehicleClass.replace(/_/g, " ")}</span>
        </div>
        <div class="detail-row">
          <span class="label">PASSENGERS</span>
          <span class="value">${passengers}</span>
        </div>
        <div class="total-row">
          <span class="total-label">TOTAL PAID</span>
          <span class="total-value">€${totalAmount}</span>
        </div>
      </div>
      <p style="color:#888;font-size:13px;margin-top:24px;">Need assistance? Contact us anytime:</p>
      <a href="https://wa.me/34635383712" class="wa-btn">WhatsApp Support</a>
    </div>
    <div class="footer">
      <p>© 2025 Élite BCN Transfers · vtcbcn2025@gmail.com · +34 635 383 712</p>
      <p style="margin-top:8px;">Barcelona, Spain · Licensed VTC Operator</p>
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `✓ Booking Confirmed — ${confirmationCode} | Élite BCN`,
    html,
  });
}

export async function sendAdminNewBookingAlert({
  confirmationCode,
  guestName,
  guestEmail,
  pickupAddress,
  dropoffAddress,
  pickupDatetime,
  vehicleClass,
  totalAmount,
}: {
  confirmationCode: string;
  guestName: string;
  guestEmail: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  vehicleClass: string;
  totalAmount: number;
}) {
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `🚗 New Booking — ${confirmationCode}`,
    html: `
      <h2>New Booking Received</h2>
      <p><b>Code:</b> ${confirmationCode}</p>
      <p><b>Client:</b> ${guestName} (${guestEmail})</p>
      <p><b>Pickup:</b> ${pickupAddress}</p>
      <p><b>Dropoff:</b> ${dropoffAddress}</p>
      <p><b>DateTime:</b> ${pickupDatetime}</p>
      <p><b>Vehicle:</b> ${vehicleClass}</p>
      <p><b>Amount:</b> €${totalAmount}</p>
      <p><a href="${process.env.NEXTAUTH_URL}/admin/bookings">View in Admin Panel</a></p>
    `,
  });
}

export async function sendDriverAssignedEmail({
  to,
  name,
  confirmationCode,
  driverName,
  driverPhone,
  vehicleMake,
  vehicleModel,
  licensePlate,
  pickupDatetime,
}: {
  to: string;
  name: string;
  confirmationCode: string;
  driverName: string;
  driverPhone: string;
  vehicleMake: string;
  vehicleModel: string;
  licensePlate: string;
  pickupDatetime: string;
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your Driver is Assigned — ${confirmationCode} | Élite BCN`,
    html: `
      <h2>Your Chauffeur is Assigned</h2>
      <p>Dear ${name},</p>
      <p>Your professional chauffeur has been assigned for your upcoming journey.</p>
      <ul>
        <li><b>Driver:</b> ${driverName}</li>
        <li><b>Phone:</b> ${driverPhone}</li>
        <li><b>Vehicle:</b> ${vehicleMake} ${vehicleModel}</li>
        <li><b>Plate:</b> ${licensePlate}</li>
        <li><b>Pickup:</b> ${pickupDatetime}</li>
      </ul>
    `,
  });
}
