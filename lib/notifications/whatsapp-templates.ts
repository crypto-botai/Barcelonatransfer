/**
 * Which WhatsApp message is a template, and what goes in its slots.
 *
 * A template is wording Meta has approved in advance, with numbered slots. It
 * is the only kind of WhatsApp message that may be sent to a customer who has
 * not written to us in the last 24 hours, which for a confirmation, a driver
 * assignment or a flight delay is nearly everybody. Sent as free text those
 * messages are accepted by our code and refused by Meta, and the only trace is
 * a "skipped" in the audit log.
 *
 * The list of templates, their wording and their slots is in
 * lib/whatsapp-template-defs.ts, which is also what the settings screen
 * submits to Meta. This file only turns an event into the template to send.
 *
 * Each template's name can be overridden by an environment variable, for the
 * day one is resubmitted under a new name after Meta rejects the first. Without
 * the variable the template is sent under its own name.
 */

import type { NotificationEvent } from "./events";
import { TEMPLATE_DEFS } from "@/lib/whatsapp-template-defs";

export interface WhatsAppTemplateSpec {
  /** Environment variable that can override the template's name. */
  env: string;
  /** The name it is submitted under. */
  fallbackName: string;
  /** Variable names, in slot order. */
  fields: readonly string[];
  /** The wording submitted to Meta. */
  suggestedText: string;
}

export const WHATSAPP_TEMPLATES: Partial<Record<NotificationEvent, WhatsAppTemplateSpec>> = Object.fromEntries(
  TEMPLATE_DEFS.map((t) => [
    t.event,
    { env: `WA_TEMPLATE_${t.event}`, fallbackName: t.name, fields: t.fields, suggestedText: t.body } satisfies WhatsAppTemplateSpec,
  ]),
);

// The confirmation's override has always had this name, and is already set in production.
WHATSAPP_TEMPLATES.BOOKING_CONFIRMED!.env = "WA_TEMPLATE_BOOKING_CONFIRMED";

/** The approved template to use for an event, or null to send free text. */
export function whatsappTemplateFor(
  event: NotificationEvent,
): { name: string; fields: readonly string[] } | null {
  const spec = WHATSAPP_TEMPLATES[event];
  if (!spec) return null;
  const name = process.env[spec.env]?.trim() || spec.fallbackName;
  return name ? { name, fields: spec.fields } : null;
}
