import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { TEMPLATE_DEFS, renderTemplate } from "@/lib/whatsapp-template-defs";
import { recordOutbound } from "@/lib/whatsapp-inbox-store";
import { confirmationFields, driverAssignedFields, type MessageBooking } from "@/lib/whatsapp-messages";

export const dynamic = "force-dynamic";

/**
 * Sends the office three sample messages (booking confirmation, driver assigned,
 * flight delayed) to a number it names, so the approved templates and the
 * payment method can be seen working end to end. The details are made up and
 * the reference says TEST, so nothing here touches a real booking.
 */

const SAMPLE: MessageBooking = {
  confirmationCode: "EBC-TEST", status: "CONFIRMED", guestName: "Test Passenger", guestEmail: "test@elitebcn.info", guestPhone: null,
  pickupAddress: "Barcelona Airport Terminal 1", dropoffAddress: "Hotel Arts Barcelona",
  pickupDatetime: new Date(Date.now() + 3 * 86_400_000), passengers: 2, luggage: 2, vehicleClass: "BUSINESS", flightNumber: "VY1875",
  specialRequests: null, totalAmount: 95, paymentStatus: "PAID", paymentMethod: "CARD_LINK",
  depositAmount: null, balanceAmount: null, balancePaidAt: null, driverAmount: null,
};

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { phone } = (await req.json().catch(() => ({}))) as { phone?: string };
  if (!phone || !/^\+\d{8,15}$/.test(phone.replace(/[\s-]/g, ""))) {
    return NextResponse.json({ error: "Give the number with its country code, e.g. +34635383712." }, { status: 422 });
  }
  const to = phone.replace(/[\s-]/g, "");

  const values: Record<string, Record<string, string>> = {
    BOOKING_CONFIRMED: confirmationFields(SAMPLE),
    DRIVER_ASSIGNED: driverAssignedFields(SAMPLE, { name: "Test Chauffeur", phone: "+34600000000", vehicle: { make: "Mercedes", model: "E-Class", licensePlate: "0000 TST" } }),
    FLIGHT_DELAYED: { code: "EBC-TEST", flight: "VY1875", when: "later today (sample)" },
  };

  const results: Record<string, unknown> = {};
  for (const event of Object.keys(values)) {
    const def = TEMPLATE_DEFS.find((t) => t.event === event);
    if (!def) { results[event] = { outcome: "failed", reason: "template not defined" }; continue; }
    const name = process.env[`WA_TEMPLATE_${def.name.toUpperCase()}`] || def.name;
    const sent = await sendWhatsAppTemplate(to, name, def.fields.map((f) => values[event][f] ?? "-"), def.language);
    results[def.name] = sent;
    // Logged in the chat, so Meta's delivery report (delivered, read, or the reason it failed) shows up beside it.
    if (sent.outcome === "sent" && sent.id) {
      await recordOutbound({ phone: to, wamid: sent.id, text: `[TEST] ${renderTemplate(def, values[event])}`, by: admin.name }).catch(() => {});
    }
  }
  return NextResponse.json({ to, results });
}
