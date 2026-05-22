import { NextRequest, NextResponse } from "next/server";
import {
  sendBookingConfirmation,
  sendAdminNewBookingAlert,
  sendPaymentConfirmationEmail,
  sendFailedPaymentEmail,
  sendBookingCancelledEmail,
  sendDriverAssignedEmail,
  sendDriverBookingDetailsEmail,
  sendPickupReminder,
  sendReviewRequestEmail,
  sendWelcomeEmail,
} from "@/lib/resend";

// Simple bearer-token guard — temporary test route, no session required
const TEST_SECRET = "elite-test-email-2026";

const ADMIN = process.env.ADMIN_EMAIL ?? "vtcbcn2025@gmail.com";

const MOCK = {
  to:               ADMIN,
  name:             "Admin Test",
  confirmationCode: "635383TT",
  pickupAddress:    "Barcelona El Prat Airport T1, 08820",
  dropoffAddress:   "W Hotel, Passeig de la Barceloneta, Barcelona",
  pickupDatetime:   "22/05/2026, 14:30",
  vehicleClass:     "BUSINESS_VAN",
  totalAmount:      95.00,
  passengers:       3,
  luggage:          2,
  bookingId:        "test-booking-id-001",
  transactionId:    "TXN-SUMUP-98765",
  driverName:       "Carlos Méndez",
  driverPhone:      "+34 635 383 712",
  vehicleMake:      "Mercedes-Benz",
  vehicleModel:     "V-Class",
  licensePlate:     "1234 BCN",
  guestPhone:       "+34 600 123 456",
  flightNumber:     "VY1234",
  specialRequests:  "Child seat required. Meet & greet requested.",
  driverAmount:     72.00,
  password:         "Abc12345xZ",
};

const EMAIL_TYPES: Record<string, () => Promise<void>> = {
  "1-booking-confirmation": () => sendBookingConfirmation({
    to:               MOCK.to,
    name:             MOCK.name,
    confirmationCode: MOCK.confirmationCode,
    pickupAddress:    MOCK.pickupAddress,
    dropoffAddress:   MOCK.dropoffAddress,
    pickupDatetime:   MOCK.pickupDatetime,
    vehicleClass:     MOCK.vehicleClass,
    totalAmount:      MOCK.totalAmount,
    passengers:       MOCK.passengers,
    bookingId:        MOCK.bookingId,
  }),

  "2-admin-alert": () => sendAdminNewBookingAlert({
    confirmationCode: MOCK.confirmationCode,
    guestName:        MOCK.name,
    guestEmail:       MOCK.to,
    pickupAddress:    MOCK.pickupAddress,
    dropoffAddress:   MOCK.dropoffAddress,
    pickupDatetime:   MOCK.pickupDatetime,
    vehicleClass:     MOCK.vehicleClass,
    totalAmount:      MOCK.totalAmount,
  }),

  "3-payment-confirmation": () => sendPaymentConfirmationEmail({
    to:               MOCK.to,
    name:             MOCK.name,
    confirmationCode: MOCK.confirmationCode,
    pickupAddress:    MOCK.pickupAddress,
    dropoffAddress:   MOCK.dropoffAddress,
    pickupDatetime:   MOCK.pickupDatetime,
    vehicleClass:     MOCK.vehicleClass,
    totalAmount:      MOCK.totalAmount,
    passengers:       MOCK.passengers,
    bookingId:        MOCK.bookingId,
    transactionId:    MOCK.transactionId,
  }),

  "4-payment-failed": () => sendFailedPaymentEmail({
    to:               MOCK.to,
    name:             MOCK.name,
    confirmationCode: MOCK.confirmationCode,
    bookingId:        MOCK.bookingId,
  }),

  "5-booking-cancelled": () => sendBookingCancelledEmail({
    to:               MOCK.to,
    name:             MOCK.name,
    confirmationCode: MOCK.confirmationCode,
    pickupDatetime:   MOCK.pickupDatetime,
    totalAmount:      MOCK.totalAmount,
  }),

  "6-driver-assigned": () => sendDriverAssignedEmail({
    to:               MOCK.to,
    name:             MOCK.name,
    confirmationCode: MOCK.confirmationCode,
    driverName:       MOCK.driverName,
    driverPhone:      MOCK.driverPhone,
    vehicleMake:      MOCK.vehicleMake,
    vehicleModel:     MOCK.vehicleModel,
    licensePlate:     MOCK.licensePlate,
    pickupDatetime:   MOCK.pickupDatetime,
  }),

  "7-driver-booking-details": () => sendDriverBookingDetailsEmail({
    to:               MOCK.to,
    driverName:       MOCK.driverName,
    confirmationCode: MOCK.confirmationCode,
    guestName:        MOCK.name,
    guestPhone:       MOCK.guestPhone,
    pickupAddress:    MOCK.pickupAddress,
    dropoffAddress:   MOCK.dropoffAddress,
    pickupDatetime:   MOCK.pickupDatetime,
    vehicleClass:     MOCK.vehicleClass,
    passengers:       MOCK.passengers,
    luggage:          MOCK.luggage,
    flightNumber:     MOCK.flightNumber,
    specialRequests:  MOCK.specialRequests,
    driverAmount:     MOCK.driverAmount,
  }),

  "8-pickup-reminder": () => sendPickupReminder({
    to:               MOCK.to,
    name:             MOCK.name,
    confirmationCode: MOCK.confirmationCode,
    pickupAddress:    MOCK.pickupAddress,
    pickupDatetime:   MOCK.pickupDatetime,
    vehicleClass:     MOCK.vehicleClass,
  }),

  "9-review-request": () => sendReviewRequestEmail({
    to:               MOCK.to,
    name:             MOCK.name,
    confirmationCode: MOCK.confirmationCode,
    bookingId:        MOCK.bookingId,
  }),

  "10-welcome": () => sendWelcomeEmail({
    to:               MOCK.to,
    name:             MOCK.name,
    password:         MOCK.password,
    confirmationCode: MOCK.confirmationCode,
    totalAmount:      MOCK.totalAmount,
  }),
};

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TEST_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await req.json().catch(() => ({ type: null }));

  if (type === "all") {
    const results: Record<string, string> = {};
    for (const [key, fn] of Object.entries(EMAIL_TYPES)) {
      try {
        await fn();
        results[key] = "OK";
      } catch (err) {
        results[key] = err instanceof Error ? err.message : String(err);
      }
    }
    return NextResponse.json({ results, sentTo: ADMIN });
  }

  const fn = EMAIL_TYPES[type as string];
  if (!fn) {
    return NextResponse.json({
      error: `Unknown type. Available: ${Object.keys(EMAIL_TYPES).join(", ")}`,
    }, { status: 400 });
  }

  try {
    await fn();
    return NextResponse.json({ ok: true, type, sentTo: ADMIN });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[test-emails] ${type}:`, err);
    return NextResponse.json({ ok: false, type, error: msg }, { status: 500 });
  }
}
