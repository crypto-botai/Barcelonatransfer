import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/whatsapp-settings-store";
import {
  ADMIN_EVENTS, CUSTOMER_EVENTS, DRIVER_EVENTS, DEFAULT_AUTO_MESSAGES, decideWhatsApp, isCustomerEvent, sameness,
  type Verdict,
} from "@/lib/whatsapp-policy";

/**
 * Asks the policy whether this WhatsApp message should go, with the facts.
 *
 * The facts are the booking (is it paid, is it cancelled, when is pickup) and
 * the notification audit trail, which already records every message sent and by
 * which channel. Reading that trail, instead of keeping a second counter, means
 * the limit cannot drift from what was really sent.
 *
 * A failure to look any of it up never blocks a message that has the right to
 * go: the service must keep working when the database hiccups, and the callers
 * that matter (the payment confirmation) have their own once-only guard.
 */
export async function whatsappVerdict(input: {
  event: string;
  bookingId?: string | null;
  vars?: Record<string, unknown>;
  now?: Date;
}): Promise<Verdict> {
  const now = input.now ?? new Date();
  let settings = DEFAULT_AUTO_MESSAGES;
  let booking: Awaited<ReturnType<typeof loadBooking>> = null;
  let sentBefore = 0;
  let repeated = false;
  let lastCustomerSendAt: Date | null = null;

  try {
    settings = (await loadSettings()).autoMessages;
    if (input.bookingId) {
      booking = await loadBooking(input.bookingId);
      const rows = await prisma.activityLog.findMany({
        where: {
          entity: "Notification",
          entityId: input.bookingId,
          action: { in: [...CUSTOMER_EVENTS, ...DRIVER_EVENTS, ...ADMIN_EVENTS].map((e) => `NOTIFY_${e}`) },
        },
        orderBy: { createdAt: "desc" },
        take: 60,
        select: { action: true, createdAt: true, details: true },
      });
      for (const r of rows) {
        const d = (r.details ?? {}) as Record<string, unknown> & { channels?: { whatsapp?: string } };
        if (d.channels?.whatsapp !== "sent") continue;
        const event = r.action.replace(/^NOTIFY_/, "");
        if (event === input.event) {
          sentBefore++;
          if (sameness(input.event, input.vars, d)) repeated = true;
        }
        if (isCustomerEvent(event) && (!lastCustomerSendAt || r.createdAt > lastCustomerSendAt)) lastCustomerSendAt = r.createdAt;
      }
    }
  } catch (e) {
    console.warn("[whatsapp] guard lookup failed, using defaults:", (e as Error)?.message);
  }

  return decideWhatsApp({ event: input.event, booking, sentBefore, repeated, lastCustomerSendAt, now, settings });
}

async function loadBooking(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    select: { status: true, paymentStatus: true, paymentMethod: true, pickupDatetime: true },
  });
}
