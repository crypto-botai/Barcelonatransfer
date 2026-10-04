import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications/service";
import { ownerNumber } from "@/lib/whatsapp";
import {
  cancelledFields, completedFields, confirmationFields, driverAssignedFields, driverCancelledFields, driverJobFields, requestFields,
  type Fields, type MessageBooking, type MessageDriver,
} from "@/lib/whatsapp-messages";

/**
 * The moments a booking changes hands, as WhatsApp messages.
 *
 * Each function says one thing happened and the rest follows: it loads the
 * booking, works out the words for whoever should hear (the customer, the
 * chauffeur, the office), and sends through notify(). notify() is where the
 * rules are applied (lib/whatsapp-policy.ts): once per booking, only when the
 * booking warrants it, only to the right person. So calling one of these twice,
 * or for a booking that should not be messaged, sends nothing the second time
 * and says why in the audit log.
 *
 * None of them throws. A message that cannot go must never stop the payment,
 * the assignment or the cancellation that caused it.
 */

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";

/** The office's own WhatsApp number, as configured. */
export const officeNumber = () => ownerNumber(process.env.WA_ADMIN_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);

type DriverRow = {
  userId: string;
  whatsappNumber: string | null;
  user: { name: string | null; phone: string | null };
  vehicles: { make: string; model: string; licensePlate: string }[];
};

export const driverFacts = (d: DriverRow | null | undefined): MessageDriver | null =>
  d ? { name: d.user.name, phone: d.user.phone ?? d.whatsappNumber, vehicle: d.vehicles[0] ?? null } : null;

async function load(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { driver: { include: { user: { select: { name: true, phone: true } }, vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } } } } },
  });
}

const flat = (f: Fields): Record<string, string> => f;
const safe = async (label: string, fn: () => Promise<unknown>) => {
  try { await fn(); } catch (e) { console.warn(`[whatsapp] ${label}:`, (e as Error)?.message); }
};

/** The fields a customer's confirmation needs, for the callers that send it themselves. */
export const confirmationVars = (b: MessageBooking, driver?: MessageDriver | null) => flat(confirmationFields(b, driver));

/** The fields for the customer's "your chauffeur" message, for the callers that send it themselves. */
export const driverAssignedVars = (b: MessageBooking, driver: MessageDriver) => flat(driverAssignedFields(b, driver));

/** The office's own copy of a paid booking. */
export async function tellOfficeBookingConfirmed(bookingId: string): Promise<void> {
  await safe("office confirmation", async () => {
    const to = officeNumber();
    const b = await load(bookingId);
    if (!to || !b) return;
    await notify({
      event: "BOOKING_CONFIRMED_ADMIN", channels: ["whatsapp"], bookingId, phone: to,
      vars: { code: b.confirmationCode, ...flat(confirmationFields(b, driverFacts(b.driver))) },
    });
  });
}

/** A new enquiry: someone has started a booking and not paid. */
export async function tellOfficeNewLead(lead: {
  name?: string | null; email?: string | null; phone?: string | null; pickup?: string | null; dropoff?: string | null;
  when?: string | null; passengers?: number | null; flight?: string | null; luggage?: number | null;
}): Promise<void> {
  await safe("office new request", async () => {
    const to = officeNumber();
    if (!to) return;
    await notify({ event: "NEW_LEAD", channels: ["whatsapp"], phone: to, vars: { ...flat(requestFields(lead)), name: lead.name?.trim() || "A customer" } });
  });
}

/** A job given to a chauffeur: what they need, their own fare, and no one else's money. */
export async function tellDriverNewJob(bookingId: string): Promise<void> {
  await safe("driver new job", async () => {
    const b = await load(bookingId);
    if (!b?.driver) return;
    await notify({
      event: "DRIVER_NEW_JOB", channels: ["whatsapp"], bookingId, phone: b.driver.user.phone ?? b.driver.whatsappNumber,
      vars: { recipient: b.driver.userId, code: b.confirmationCode, ...flat(driverJobFields(b)) },
    });
  });
}

/** The journey is done: thank the customer, with the link to rate it. */
export async function tellCustomerJourneyCompleted(bookingId: string): Promise<void> {
  await safe("journey completed", async () => {
    const b = await load(bookingId);
    if (!b?.guestPhone) return;
    await notify({
      event: "RATE_RIDE", channels: ["whatsapp"], bookingId, userId: b.userId, phone: b.guestPhone,
      vars: { code: b.confirmationCode, ...flat(completedFields(b, `${SITE_URL}/review?booking=${b.id}`)) },
    });
  });
}

/** A cancellation: the customer who had paid, and the chauffeur who was going to drive it. */
export async function tellBookingCancelled(bookingId: string): Promise<void> {
  await safe("booking cancelled", async () => {
    const b = await load(bookingId);
    if (!b) return;
    if (b.guestPhone) {
      await notify({
        event: "BOOKING_CANCELLED", channels: ["whatsapp"], bookingId, userId: b.userId, phone: b.guestPhone,
        vars: { code: b.confirmationCode, ...flat(cancelledFields(b)) },
      });
    }
    if (b.driver) {
      await notify({
        event: "DRIVER_JOB_CANCELLED", channels: ["whatsapp"], bookingId, phone: b.driver.user.phone ?? b.driver.whatsappNumber,
        vars: { recipient: b.driver.userId, code: b.confirmationCode, ...flat(driverCancelledFields(b)) },
      });
    }
  });
}
