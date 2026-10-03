/**
 * The WhatsApp templates the site depends on, in one list.
 *
 * A template is wording Meta approves in advance. Business-initiated messages
 * (a confirmation, a driver's name, a delay) can only go out as one, because
 * the customer has usually not written to us in the last 24 hours. Each entry
 * here is exactly what gets submitted for approval, so the wording the office
 * sees in settings, the wording Meta reviews and the wording customers get are
 * the same text.
 *
 * Meta's rules, which the wording below follows:
 *   - a {{n}} slot may not be the first or last thing in the body
 *   - slots are numbered from 1 with no gaps, filled by position
 *   - every slot needs an example, or the submission is refused
 *   - UTILITY is for messages about something the customer already bought.
 *     Anything that reads as promotion is reclassified as MARKETING, which is
 *     priced higher and needs consent, so nothing here sells anything.
 */

export interface TemplateDef {
  /** The name in Meta. Lower case, digits and underscores only. */
  name: string;
  /** The notification event it carries. */
  event: "BOOKING_CONFIRMED" | "DRIVER_ASSIGNED" | "FLIGHT_DELAYED" | "PICKUP_SOON" | "FLIGHT_DELAYED_DRIVER";
  /** Who receives it, for the settings screen. */
  to: "customer" | "driver";
  /** What the office is told it is for. */
  purpose: string;
  /** Variable names in slot order. */
  fields: readonly string[];
  /** The body, with {{1}}, {{2}}… */
  body: string;
  /** One example per slot, shown to Meta's reviewer. */
  examples: readonly string[];
  category: "UTILITY";
  language: "en";
}

export const TEMPLATE_DEFS: readonly TemplateDef[] = [
  {
    name: "booking_confirmation",
    event: "BOOKING_CONFIRMED",
    to: "customer",
    purpose: "Sent once, when a booking is paid.",
    fields: ["code", "when", "route"],
    body: "Hello, your Elite BCN transfer is confirmed. Reference {{1}}. Pickup {{2}}. Route {{3}}. Reply to this message if you need anything.",
    examples: ["EBC-4821", "14 Oct 12:00", "Barcelona Airport T1 to Hotel Arts"],
    category: "UTILITY",
    language: "en",
  },
  {
    name: "driver_assigned",
    event: "DRIVER_ASSIGNED",
    to: "customer",
    purpose: "Sent when a driver is assigned to a paid booking.",
    fields: ["code", "driver", "when"],
    body: "Your Elite BCN driver for transfer {{1}} is {{2}}. They will collect you on {{3}}. Reply to this message if you need to reach us.",
    examples: ["EBC-4821", "Pedro", "14 Oct 12:00"],
    category: "UTILITY",
    language: "en",
  },
  {
    name: "flight_delayed",
    event: "FLIGHT_DELAYED",
    to: "customer",
    purpose: "Sent when a customer's flight lands later than planned.",
    fields: ["code", "flight", "when"],
    body: "Elite BCN update for transfer {{1}}: flight {{2}} is delayed and now lands {{3}}. Your driver has been told. You do not need to do anything.",
    examples: ["EBC-4821", "VY1875", "14 Oct 13:20"],
    category: "UTILITY",
    language: "en",
  },
  {
    name: "pickup_soon",
    event: "PICKUP_SOON",
    to: "customer",
    purpose: "One heads-up about an hour before pickup.",
    fields: ["code", "when", "route"],
    body: "Elite BCN: your transfer {{1}} is coming up in about an hour. Pickup {{2}}. Route {{3}}. Reply here if anything has changed.",
    examples: ["EBC-4821", "14 Oct 12:00", "Barcelona Airport T1 to Hotel Arts"],
    category: "UTILITY",
    language: "en",
  },
  {
    name: "driver_flight_delay",
    event: "FLIGHT_DELAYED_DRIVER",
    to: "driver",
    purpose: "Sent to the driver when their passenger's flight lands later than planned.",
    fields: ["code", "passenger", "flight", "when", "pickup"],
    body: "Elite BCN driver update for booking {{1}}: {{2}} is on flight {{3}}, which now lands {{4}}. Please collect from {{5}} at the new time.",
    examples: ["EBC-4821", "Ana Smith", "VY1875", "14 Oct 13:20", "Terminal 1 arrivals"],
    category: "UTILITY",
    language: "en",
  },
];

/** Problems that would make Meta refuse a template, found before submitting. */
export function templateProblems(t: TemplateDef): string[] {
  const out: string[] = [];
  if (!/^[a-z0-9_]{1,512}$/.test(t.name)) out.push("the name must be lower case letters, digits and underscores");
  const slots = [...t.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  if (slots.length !== t.fields.length || slots.some((n, i) => n !== i + 1)) out.push("the slots must be {{1}}, {{2}}… in order with none missing");
  if (t.examples.length !== slots.length) out.push("there must be one example per slot");
  if (/^\s*\{\{/.test(t.body) || /\}\}\s*[.!?]?\s*$/.test(t.body)) out.push("a slot cannot be the first or last thing in the body");
  if (t.body.length > 1024) out.push("the body is over 1024 characters");
  if (/\n{3,}|\t| {4,}/.test(t.body)) out.push("the body has too many blank lines or spaces");
  return out;
}
