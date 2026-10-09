import { prisma } from "@/lib/prisma";

/**
 * Push notifications to the EliteBCN mobile apps, through Expo's push service.
 *
 * A push is a nudge, not the data: the payload names the ride, and the app fetches
 * the ride from the server when it is opened. Nothing a person must not see (a
 * price, a phone number, an address) is put in a notification, because a lock
 * screen is public.
 *
 * Never throws. A phone that cannot be reached must not roll back a booking. A token
 * the service reports as dead (the app was uninstalled) is removed.
 */

const ENDPOINT = "https://exp.host/--/api/v2/push/send";

/** Moments that reach the apps. Customer events and driver events, nothing the office sees. */
export const MOBILE_EVENTS: ReadonlySet<string> = new Set([
  "BOOKING_CONFIRMED",
  "PAYMENT_RECEIVED",
  "DRIVER_ASSIGNED",
  "PICKUP_REMINDER",
  "PICKUP_SOON",
  "RIDE_TODAY",
  "FLIGHT_DELAYED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "DRIVER_WAITING",
  "RIDE_ON_BOARD",
  "RIDE_COMPLETED",
  "RATE_RIDE",
  "BOOKING_CANCELLED",
  "TRIP_MESSAGE",
  "DRIVER_NEW_JOB",
  "DRIVER_JOB_CANCELLED",
  "FLIGHT_DELAYED_DRIVER",
]);

export interface MobilePushMessage {
  title: string;
  body: string;
  /** What the app needs to open the right screen. Identifiers only. */
  data: { event: string; bookingId?: string };
}

export interface MobilePushResult {
  sent: number;
  failed: number;
  skipped?: string;
}

interface Ticket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

export async function sendMobilePushToUser(userId: string, msg: MobilePushMessage, fetchImpl: typeof fetch = fetch): Promise<MobilePushResult> {
  let devices: { token: string }[];
  try {
    devices = await prisma.mobileDevice.findMany({ where: { userId }, select: { token: true }, take: 10 });
  } catch {
    // The table does not exist yet on a database that has not been updated: there is nobody to reach.
    return { sent: 0, failed: 0, skipped: "no mobile devices table" };
  }
  if (devices.length === 0) return { sent: 0, failed: 0, skipped: "no mobile devices" };

  const messages = devices.map((d) => ({
    to: d.token,
    title: msg.title,
    body: msg.body,
    data: msg.data,
    sound: "default",
    priority: "high",
    channelId: "rides",
    // Repeat pushes about one ride replace each other on the lock screen.
    collapseId: msg.data.bookingId ? `${msg.data.bookingId}:${msg.data.event}` : undefined,
  }));

  let tickets: Ticket[] = [];
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) return { sent: 0, failed: devices.length };
    const json = (await res.json()) as { data?: Ticket[] };
    tickets = json.data ?? [];
  } catch {
    return { sent: 0, failed: devices.length };
  }

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    if (t.status === "ok") sent += 1;
    else {
      failed += 1;
      if (t.details?.error === "DeviceNotRegistered" && devices[i]) dead.push(devices[i].token);
    }
  });
  if (dead.length) await prisma.mobileDevice.deleteMany({ where: { token: { in: dead } } }).catch(() => undefined);
  return { sent, failed };
}
