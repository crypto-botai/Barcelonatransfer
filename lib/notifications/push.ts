/**
 * Web push delivery.
 *
 * Uses the VAPID protocol, which is free and needs no third-party service: the
 * keypair is generated once locally and the browser's own push service (Google,
 * Mozilla, Apple) does the delivery. No account, no per-message cost.
 *
 * Subscriptions go stale constantly — people clear site data, uninstall the
 * PWA, or the push service rotates an endpoint. A 404 or 410 from the push
 * service is the documented signal that an endpoint is dead, so those prune the
 * row rather than being logged as failures.
 */

import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT ?? "mailto:vtcbcn2025@gmail.com";

  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushResult {
  sent: number;
  pruned: number;
  failed: number;
  /** No keys configured, or the user has no registered devices. */
  skipped?: string;
}

/**
 * Sends to every device this user has opted in on.
 *
 * Never throws: push is the least important channel in the notification fan-out
 * and must not be able to fail a booking confirmation.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  if (!ensureConfigured()) return { sent: 0, pruned: 0, failed: 0, skipped: "VAPID keys not configured" };

  const subs = await prisma.pushSubscription.findMany({ where: { userId } }).catch(() => []);
  if (subs.length === 0) return { sent: 0, pruned: 0, failed: 0, skipped: "no registered devices" };

  const body = JSON.stringify(payload);
  let sent = 0, pruned = 0, failed = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404 Not Found / 410 Gone: the endpoint no longer exists. Expected.
        if (status === 404 || status === 410) {
          dead.push(s.id);
          pruned++;
        } else {
          failed++;
          console.warn("[push] send failed:", status, (e as Error).message);
        }
      }
    }),
  );

  if (dead.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } }).catch(() => {});
  }
  if (sent > 0) {
    await prisma.pushSubscription
      .updateMany({ where: { userId }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return { sent, pruned, failed };
}
