/**
 * Which WhatsApp message is a template, and what goes in its slots.
 *
 * A template is wording Meta has approved in advance, with numbered slots. It
 * is the only kind of WhatsApp message that may be sent to a customer who has
 * not written to us in the last 24 hours, which for a reminder, a driver
 * assignment or a flight delay is nearly everybody. Sent as free text those
 * messages are accepted by our code and refused by Meta, and the only trace is
 * a "skipped" in the audit log.
 *
 * Each entry names the environment variable that holds the template's approved
 * name. Nothing is sent as a template until that variable is set, so creating
 * a template in Meta and adding its name in Vercel is the whole switch; until
 * then the message falls back to free text exactly as it did before.
 *
 * `fields` are the variable names, in the order the slots appear. Meta fills
 * {{1}}, {{2}} and {{3}} by position, so this order and the order of the
 * placeholders in the template as it was submitted must match.
 */

import type { NotificationEvent } from "./events";

export interface WhatsAppTemplateSpec {
  /** Environment variable holding the approved template name. */
  env: string;
  /** Used when the variable is unset. Only the original confirmation has one. */
  fallbackName?: string;
  /** Variable names, in slot order. */
  fields: readonly string[];
  /** The wording to submit in Meta Business Manager, for the office to copy. */
  suggestedText: string;
}

export const WHATSAPP_TEMPLATES: Partial<Record<NotificationEvent, WhatsAppTemplateSpec>> = {
  BOOKING_CONFIRMED: {
    env: "WA_TEMPLATE_BOOKING_CONFIRMED",
    // The confirmation has always been a template, under this name.
    fallbackName: "booking_confirmation",
    fields: ["code", "when", "route"],
    suggestedText:
      "Hello, your Elite BCN transfer is confirmed. Reference {{1}}. Pickup {{2}}. Route {{3}}. Reply to this message if you need anything.",
  },
  PICKUP_REMINDER: {
    env: "WA_TEMPLATE_PICKUP_REMINDER",
    fields: ["code", "when", "route"],
    suggestedText:
      "Reminder from Elite BCN: your transfer {{1}} is coming up. Pickup {{2}}. Route {{3}}. Reply to this message if anything has changed.",
  },
  DRIVER_ASSIGNED: {
    env: "WA_TEMPLATE_DRIVER_ASSIGNED",
    fields: ["code", "driver", "when"],
    suggestedText:
      "Your Elite BCN driver for transfer {{1}} is {{2}}. They will collect you on {{3}}. Reply to this message if you need to reach us.",
  },
  FLIGHT_DELAYED: {
    env: "WA_TEMPLATE_FLIGHT_DELAYED",
    fields: ["code", "flight", "when"],
    suggestedText:
      "Elite BCN update for transfer {{1}}: flight {{2}} is delayed and now lands {{3}}. Your driver has been told. You do not need to do anything.",
  },
};

/** The approved template to use for an event, or null to send free text. */
export function whatsappTemplateFor(
  event: NotificationEvent,
): { name: string; fields: readonly string[] } | null {
  const spec = WHATSAPP_TEMPLATES[event];
  if (!spec) return null;
  const name = process.env[spec.env]?.trim() || spec.fallbackName;
  return name ? { name, fields: spec.fields } : null;
}
