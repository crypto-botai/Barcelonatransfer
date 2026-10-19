import { prisma } from "@/lib/prisma";

/**
 * Push notifications to the EliteBCN mobile apps, through Expo's push service.
 *
 * A push is a nudge, not the data: the payload names the ride, and the app fetches
 * the ride from the server when it is opened. Nothing a person must not see (a
 * price, a phone number, an address) is put in a notification, because a lock
 * screen is public.
 *
 * Never throws. A phone that cannot be reached must not roll back a booking.
 *
 * Delivery is a two-step thing with Expo: the send answers with a "ticket" per
 * message (accepted or refused), and a few minutes later a "receipt" says whether
 * Apple or Google took it. Credential problems (a missing FCM key, an APNs key that
 * was revoked) only show in the receipt, so the receipts are read too. What is
 * logged is the event, counts and Expo's error codes: never a push token, which
 * addresses a person's phone.
 */

const ENDPOINT = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_ENDPOINT = "https://exp.host/--/api/v2/push/getReceipts";

/** Activity-log actions this module writes. A send is "SENT" until its receipts are read, then "CHECKED". */
export const PUSH_SENT_ACTION = "MOBILE_PUSH_SENT";
export const PUSH_CHECKED_ACTION = "MOBILE_PUSH_CHECKED";

/** Receipts are ready after about 15 minutes; Expo keeps them for a day. */
const RECEIPT_MIN_AGE_MS = 10 * 60_000;
const RECEIPT_MAX_AGE_MS = 24 * 60 * 60_000;
/** The sweep runs at most this often per server instance, and never holds up a notification for long. */
const SWEEP_EVERY_MS = 5 * 60_000;
const SWEEP_BATCH = 20;

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
  "CHAT_MESSAGE",
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
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface Receipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

const headers = () => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
});

/** Counts by Expo error code, e.g. { InvalidCredentials: 2 }. Codes only: no token, no message text that could echo one. */
function countCodes(items: { status: string; details?: { error?: string } }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) if (i.status === "error") out[i.details?.error ?? "unknown"] = (out[i.details?.error ?? "unknown"] ?? 0) + 1;
  return out;
}

/** One retry for a busy or briefly unavailable service (rate limit, 5xx, network), so a blip does not lose a ride notification. */
async function postWithRetry(url: string, body: unknown, fetchImpl: typeof fetch, retryDelayMs: number): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchImpl(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
      if (res.ok || (res.status !== 429 && res.status < 500)) return res;
    } catch {
      /* try once more */
    }
    if (attempt === 0 && retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs));
  }
  return null;
}

export async function sendMobilePushToUser(
  userId: string,
  msg: MobilePushMessage,
  fetchImpl: typeof fetch = fetch,
  retryDelayMs = 400,
): Promise<MobilePushResult> {
  let devices: { id: string; token: string }[];
  try {
    devices = await prisma.mobileDevice.findMany({ where: { userId }, select: { id: true, token: true }, take: 10 });
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
  const res = await postWithRetry(ENDPOINT, messages, fetchImpl, retryDelayMs);
  if (!res || !res.ok) {
    console.warn(`[mobile-push] ${msg.data.event}: send failed (${res ? `HTTP ${res.status}` : "unreachable"}) for ${devices.length} device(s)`);
    return { sent: 0, failed: devices.length };
  }
  try {
    tickets = ((await res.json()) as { data?: Ticket[] }).data ?? [];
  } catch {
    return { sent: 0, failed: devices.length };
  }

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];
  const pending: { id: string; deviceId: string }[] = [];
  tickets.forEach((t, i) => {
    if (t.status === "ok") {
      sent += 1;
      if (t.id && devices[i]) pending.push({ id: t.id, deviceId: devices[i].id });
    } else {
      failed += 1;
      if (t.details?.error === "DeviceNotRegistered" && devices[i]) dead.push(devices[i].token);
    }
  });
  if (failed > 0) console.warn(`[mobile-push] ${msg.data.event}: ${failed} of ${devices.length} refused`, countCodes(tickets));
  if (dead.length) await prisma.mobileDevice.deleteMany({ where: { token: { in: dead } } }).catch(() => undefined);

  // Remember the tickets, so the receipts (where credential problems show up) can be read later. Ids and codes only.
  if (pending.length) {
    await prisma.activityLog
      .create({ data: { action: PUSH_SENT_ACTION, entity: "mobile_push", entityId: userId, details: { event: msg.data.event, tickets: pending } } })
      .catch(() => undefined);
  }
  void maybeSweep(fetchImpl);
  return { sent, failed };
}

let lastSweep = 0;
async function maybeSweep(fetchImpl: typeof fetch): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  await sweepMobilePushReceipts(fetchImpl).catch(() => undefined);
}

/** For tests: lets the throttle run again. */
export function resetPushSweepThrottle(): void {
  lastSweep = 0;
}

export interface ReceiptSweep {
  checked: number;
  errors: Record<string, number>;
  removedDevices: number;
}

/**
 * Reads Expo's receipts for pushes sent between 10 minutes and a day ago. A receipt of DeviceNotRegistered
 * removes that phone; anything else (InvalidCredentials, MessageRateExceeded, MismatchSenderId) is logged by
 * code so a missing FCM key or APNs key is visible in the platform log instead of silent.
 */
export async function sweepMobilePushReceipts(fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<ReceiptSweep> {
  const out: ReceiptSweep = { checked: 0, errors: {}, removedDevices: 0 };
  const rows = await prisma.activityLog.findMany({
    where: { action: PUSH_SENT_ACTION, createdAt: { gte: new Date(now - RECEIPT_MAX_AGE_MS), lte: new Date(now - RECEIPT_MIN_AGE_MS) } },
    orderBy: { createdAt: "asc" },
    take: SWEEP_BATCH,
    select: { id: true, details: true },
  });
  if (rows.length === 0) return out;

  const tickets = rows.flatMap((r) => ((r.details as { tickets?: { id: string; deviceId: string }[] } | null)?.tickets ?? []));
  const byId = new Map(tickets.map((t) => [t.id, t.deviceId]));
  const res = tickets.length ? await postWithRetry(RECEIPTS_ENDPOINT, { ids: tickets.map((t) => t.id) }, fetchImpl, 0) : null;
  if (!res || !res.ok) return out;
  const receipts = ((await res.json().catch(() => ({}))) as { data?: Record<string, Receipt> }).data ?? {};

  const deadDevices: string[] = [];
  for (const [id, receipt] of Object.entries(receipts)) {
    out.checked += 1;
    if (receipt.status !== "error") continue;
    const code = receipt.details?.error ?? "unknown";
    out.errors[code] = (out.errors[code] ?? 0) + 1;
    const device = byId.get(id);
    if (code === "DeviceNotRegistered" && device) deadDevices.push(device);
  }
  if (deadDevices.length) {
    const r = await prisma.mobileDevice.deleteMany({ where: { id: { in: deadDevices } } }).catch(() => ({ count: 0 }));
    out.removedDevices = r.count;
  }
  if (Object.keys(out.errors).length) console.warn("[mobile-push] receipt errors (check the Expo credentials for the app):", out.errors);

  // Done with these rows, whatever the receipts said, so they are not read twice.
  await Promise.all(
    rows.map((r) => prisma.activityLog.update({ where: { id: r.id }, data: { action: PUSH_CHECKED_ACTION } }).catch(() => undefined)),
  );
  return out;
}
