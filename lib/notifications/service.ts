/**
 * Shared notification service.
 *
 * One call fans a booking event out to every channel that event uses, writes
 * the in-app row the customer portal reads, and records an audit entry.
 *
 * Design notes:
 *
 *  - This orchestrates the existing Resend senders rather than replacing them.
 *    Those templates are rich and already proven in production, so the caller
 *    passes its own sender as `email` and this service wraps in-app delivery,
 *    WhatsApp, and auditing around it. Nothing that works today changes shape.
 *
 *  - It never throws. A notification failing must not roll back a paid booking,
 *    so every channel is attempted independently and failures are collected
 *    into the result and the audit log instead of propagating.
 *
 *  - Channels with no credentials configured report `skipped`, not `failed`.
 *    That distinction is what tells you "WhatsApp is off" apart from
 *    "WhatsApp is on and broken".
 */

import { prisma } from "@/lib/prisma";
import { sendWhatsAppText } from "@/lib/whatsapp";
import {
  copyFor,
  resolveLocale,
  EVENT_DEFS,
  type Channel,
  type NotificationEvent,
} from "./events";

export interface NotifyInput {
  event: NotificationEvent;
  /** Registered customer. Omit for guest bookings — in-app is then skipped. */
  userId?: string | null;
  /** Stored on the in-app row so the portal can deep-link to the booking. */
  bookingId?: string | null;
  locale?: string | null;
  vars?: Record<string, string | number>;
  /** Overrides the event's default channel set. */
  channels?: Channel[];
  /** The caller's own Resend sender. Without it the email channel is skipped. */
  email?: () => Promise<unknown>;
  /** Customer phone in any format; normalised downstream. */
  phone?: string | null;
}

export type ChannelOutcome = "sent" | "skipped" | "failed";

export interface NotifyResult {
  event: NotificationEvent;
  results: Record<Channel, { outcome: ChannelOutcome; reason?: string }>;
  title: string;
  body: string;
}

const errText = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const locale = resolveLocale(input.locale);
  const vars = input.vars ?? {};
  const { title, body } = copyFor(input.event, locale, vars);
  const channels = input.channels ?? EVENT_DEFS[input.event].channels;

  const results = {} as NotifyResult["results"];
  const mark = (c: Channel, outcome: ChannelOutcome, reason?: string) => {
    results[c] = reason ? { outcome, reason } : { outcome };
  };

  // ---- in-app -------------------------------------------------------------
  if (channels.includes("inapp")) {
    if (!input.userId) {
      mark("inapp", "skipped", "guest booking — no user account");
    } else {
      try {
        await prisma.notification.create({
          data: {
            userId: input.userId,
            title,
            body,
            type: input.event,
            data: {
              ...(input.bookingId ? { bookingId: input.bookingId } : {}),
              ...vars,
            },
          },
        });
        mark("inapp", "sent");
      } catch (e) {
        mark("inapp", "failed", errText(e));
      }
    }
  }

  // ---- email --------------------------------------------------------------
  if (channels.includes("email")) {
    if (!input.email) {
      mark("email", "skipped", "no sender supplied by caller");
    } else if (!process.env.RESEND_API_KEY) {
      mark("email", "skipped", "RESEND_API_KEY not configured");
    } else {
      try {
        await input.email();
        mark("email", "sent");
      } catch (e) {
        mark("email", "failed", errText(e));
      }
    }
  }

  // ---- whatsapp -----------------------------------------------------------
  if (channels.includes("whatsapp")) {
    if (!input.phone) {
      mark("whatsapp", "skipped", "no phone on booking");
    } else if (!process.env.WA_PHONE_ID || !process.env.WA_TOKEN) {
      mark("whatsapp", "skipped", "WhatsApp Cloud API not configured");
    } else {
      try {
        const sent = await sendWhatsAppText(input.phone, `${title}\n\n${body}`);
        mark("whatsapp", sent ? "sent" : "skipped", sent ? undefined : "outside 24h session window");
      } catch (e) {
        mark("whatsapp", "failed", errText(e));
      }
    }
  }

  // ---- push ---------------------------------------------------------------
  // Subscriptions and VAPID keys arrive with the PWA work. Recording the
  // intent now means enabling push later is configuration, not a rewrite.
  if (channels.includes("push")) {
    mark("push", "skipped", "web push not yet enabled");
  }

  await audit(input, results, title);

  return { event: input.event, results, title, body };
}

/**
 * Audit trail. Deliberately best-effort: if the log write fails we still want
 * the notification result returned to the caller, so this swallows its own
 * error after reporting it to the platform log.
 */
async function audit(
  input: NotifyInput,
  results: NotifyResult["results"],
  title: string,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        action: `NOTIFY_${input.event}`,
        entity: "Notification",
        entityId: input.bookingId ?? input.userId ?? null,
        details: {
          title,
          // The rendered values, not just the headline. Two things need them:
          // an audit answering "what exactly did we tell this customer?", and
          // callers that dedup on content — the flight sweep compares the
          // previously announced arrival time to decide whether a delay is new.
          // Guest bookings write no in-app row, so this is their only trace.
          ...input.vars,
          channels: Object.fromEntries(
            Object.entries(results).map(([c, r]) => [c, r.outcome]),
          ),
          failures: Object.entries(results)
            .filter(([, r]) => r.outcome === "failed")
            .map(([c, r]) => `${c}: ${r.reason}`),
        },
      },
    });
  } catch (e) {
    console.warn("[notify] audit log write failed:", errText(e));
  }
}

/** Unread badge count for the portal header. */
export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function listNotifications(userId: string, take = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function markAllRead(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return count;
}

export async function markRead(userId: string, id: string): Promise<boolean> {
  // Scoped by userId so one customer cannot mark another's notification read.
  const { count } = await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  return count > 0;
}
