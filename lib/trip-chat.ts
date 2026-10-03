import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications/service";
import type { TripSender } from "@prisma/client";

/**
 * Chat on one journey.
 *
 * Four kinds of people can be on it, and each reaches the same booking a
 * different way: the customer by owning it or by holding its confirmation
 * code (the public tracking link), the chauffeur by being assigned to it,
 * the company by having dispatched it, the office always. Working out who
 * the caller is happens here, once, so the one API route cannot get it wrong
 * for one of them.
 */

/**
 * What the customer is told a fleet company's messages come from.
 *
 * The customer booked Elite BCN and is looked after by Elite BCN. The company
 * that supplies the chauffeur is not part of what they were sold, so its name
 * is never shown to them: not on a message, and not in the alert on their phone.
 */
export const PARTNER_PUBLIC_NAME = "Elite BCN";

/**
 * The name to show beside a message. Messages written before this rule were
 * stored with the company's name, so it is applied when they are read as well
 * as when they are written.
 */
export function publicSenderName(sender: TripSender, storedName: string): string {
  return sender === "PARTNER" ? PARTNER_PUBLIC_NAME : storedName;
}

export interface Participant {
  sender: TripSender;
  name: string;
  bookingId: string;
}

export async function identifyParticipant(bookingId: string, code?: string | null): Promise<Participant | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, driverId: true, partnerId: true, guestName: true, confirmationCode: true, isDeleted: true },
  });
  if (!booking || booking.isDeleted) return null;

  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string; name?: string } | undefined;

  if (u?.role === "ADMIN") return { sender: "ADMIN", name: "Elite BCN", bookingId };

  if (u?.role === "DRIVER" && u.id) {
    const d = await prisma.driver.findUnique({ where: { userId: u.id }, select: { id: true } });
    if (d && d.id === booking.driverId) return { sender: "DRIVER", name: u.name ?? "Your chauffeur", bookingId };
    return null;
  }

  if (u?.role === "PARTNER" && u.id) {
    const p = await prisma.fleetPartner.findUnique({ where: { userId: u.id }, select: { id: true } });
    if (p && p.id === booking.partnerId) return { sender: "PARTNER", name: PARTNER_PUBLIC_NAME, bookingId };
    return null;
  }

  const customerName = booking.guestName ?? u?.name ?? "Customer";
  if (u?.id && booking.userId && u.id === booking.userId) return { sender: "CUSTOMER", name: customerName, bookingId };
  if (code && code === booking.confirmationCode) return { sender: "CUSTOMER", name: customerName, bookingId };

  return null;
}

export async function listMessages(bookingId: string, after?: string | null) {
  const rows = await prisma.tripMessage.findMany({
    where: { bookingId, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, sender: true, senderName: true, body: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, senderName: publicSenderName(r.sender, r.senderName) }));
}

export async function postMessage(p: Participant, body: string) {
  const text = body.trim().slice(0, 1000);
  if (!text) throw new Error("Empty message");
  const msg = await prisma.tripMessage.create({
    data: { bookingId: p.bookingId, sender: p.sender, senderName: p.name, body: text },
  });

  // A word from the chauffeur or the company reaches the customer's phone;
  // a word from the customer or the office reaches the driver's.
  const booking = await prisma.booking.findUnique({ where: { id: p.bookingId }, select: { userId: true, confirmationCode: true, driver: { select: { userId: true } } } });
  const vars = { from: p.name, text: text.slice(0, 120), code: booking?.confirmationCode ?? "" };
  if (p.sender !== "CUSTOMER") {
    await notify({ event: "TRIP_MESSAGE", channels: ["inapp", "push"], userId: booking?.userId ?? null, bookingId: p.bookingId, vars }).catch(() => {});
  }
  if (p.sender !== "DRIVER" && booking?.driver?.userId) {
    await notify({ event: "TRIP_MESSAGE", channels: ["inapp", "push"], userId: booking.driver.userId, url: "/driver", vars }).catch(() => {});
  }
  return { ...msg, senderName: publicSenderName(msg.sender, msg.senderName) };
}
