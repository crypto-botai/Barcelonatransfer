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
 *   - a body is at most 1024 characters
 *   - UTILITY is for messages about something the customer already bought.
 *     Anything that reads as promotion is reclassified as MARKETING, which is
 *     priced higher and needs consent, so nothing here sells anything.
 *
 * The fields are filled by name from lib/whatsapp-messages.ts, which is also
 * where it is decided what a customer, the office and a chauffeur may each see.
 * A chauffeur's templates have no slot for the fare or for what an extra cost.
 */

export type TemplateEvent =
  | "BOOKING_CONFIRMED"
  | "NEW_LEAD"
  | "DRIVER_ASSIGNED"
  | "DRIVER_NEW_JOB"
  | "RATE_RIDE"
  | "BOOKING_CANCELLED"
  | "DRIVER_JOB_CANCELLED"
  | "FLIGHT_DELAYED"
  | "PICKUP_SOON"
  | "FLIGHT_DELAYED_DRIVER";

export interface TemplateDef {
  /** The name in Meta. Lower case, digits and underscores only. */
  name: string;
  /** The notification event it carries. */
  event: TemplateEvent;
  /** Other events that send this same template, to someone else. */
  alsoFor?: readonly string[];
  /** Who receives it, for the settings screen. */
  to: "customer" | "driver" | "admin";
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

const RULE = "━━━━━━━━━━━━━━━━━━";
const SIGN_OFF = "🤝 *Thank you for choosing EliteBCN.*\n✨ *Premium Transfers • Professional Service*";

/** The booking, as the customer gave it. Shared by the confirmation and the new request. */
const BOOKING_LINES = [
  "📅 *Date & Time:* {{1}}",
  "👤 *Full Name:* {{2}}",
  "📞 *Phone / WhatsApp:* {{3}}",
  "📧 *Email:* {{4}}",
  "📍 *Pick-up Location:* {{5}}",
  "🏁 *Drop-off Location:* {{6}}",
  "✈️ *Flight Number:* {{7}}",
  "👥 *Passengers:* {{8}}",
  "🧳 *Luggage:* {{9}}",
  "👶 *Children:* {{10}}",
  "🚘 *Vehicle Type:* {{11}}",
  "➕ *Extras:* {{12}}",
  "⭐ *Special Requests:* {{13}}",
];

const BOOKING_FIELDS = ["when", "name", "phone", "email", "pickup", "dropoff", "flight", "passengers", "luggage", "children", "vehicleType", "extras", "requests"] as const;
const BOOKING_EXAMPLES = [
  "14 Oct 2026, 12:00", "Ana Smith", "+34 600 123 456", "ana@example.com", "Barcelona Airport T1", "Hotel Arts, Carrer de la Marina 19",
  "VY1875", "3", "2", "None", "Business", "Child Seat", "None",
];

export const TEMPLATE_DEFS: readonly TemplateDef[] = [
  {
    name: "elitebcn_booking_confirmation",
    event: "BOOKING_CONFIRMED",
    alsoFor: ["BOOKING_CONFIRMED_ADMIN"],
    to: "customer",
    // No driver in it: a booking comes in from the customer, and nobody is assigned until the
    // office does it. The chauffeur follows as his own message (elitebcn_driver_assigned).
    purpose: "The confirmation, sent once when a booking is paid. The same message goes to the office. The chauffeur follows in a separate message once one is assigned.",
    fields: [...BOOKING_FIELDS, "ref", "pickupPoint", "pickupTime", "price", "payment"],
    body: [
      "✨ *ELITEBCN | PREMIUM TRANSFER BOOKING* ✨",
      ...BOOKING_LINES,
      RULE,
      "✅ *BOOKING CONFIRMATION DETAILS*",
      "🔖 *Booking Reference:* {{14}}",
      "📍 *Pick-up Point:* {{15}}",
      "⏰ *Pick-up Time:* {{16}}",
      "💶 *Total Price:* {{17}}",
      "💳 *Payment Status:* {{18}}",
      RULE,
      SIGN_OFF,
    ].join("\n"),
    examples: [
      ...BOOKING_EXAMPLES,
      "EBC-4821", "Barcelona Airport T1 (arrivals, flight VY1875)", "14 Oct 2026, 12:00", "€95", "Paid in full",
    ],
    category: "UTILITY",
    language: "en",
  },
  {
    name: "elitebcn_new_request",
    event: "NEW_LEAD",
    to: "admin",
    purpose: "To the office, the moment someone starts a booking and has not paid yet.",
    fields: BOOKING_FIELDS,
    body: ["✨ *ELITEBCN | PREMIUM TRANSFER REQUEST* ✨", ...BOOKING_LINES, RULE, SIGN_OFF].join("\n"),
    examples: BOOKING_EXAMPLES,
    category: "UTILITY",
    language: "en",
  },
  {
    name: "elitebcn_driver_assigned",
    event: "DRIVER_ASSIGNED",
    to: "customer",
    purpose: "Sent when a driver is assigned to a paid booking: the chauffeur, the number and the car.",
    fields: ["ref", "driver", "driverContact", "vehicle", "plate", "pickupTime", "pickup"],
    body: [
      "✨ *ELITEBCN | CHAUFFEUR ASSIGNED* ✨",
      "🔖 *Booking Reference:* {{1}}",
      "👨‍✈️ *Your Chauffeur:* {{2}}",
      "📞 *Chauffeur Contact:* {{3}}",
      "🚘 *Vehicle:* {{4}}",
      "🔢 *Number Plate:* {{5}}",
      "⏰ *Pick-up Time:* {{6}}",
      "📍 *Pick-up Location:* {{7}}",
      RULE,
      SIGN_OFF,
    ].join("\n"),
    examples: ["EBC-4821", "Pedro Ruiz", "+34 611 222 333", "Mercedes E-Class", "1234 ABC", "14 Oct 2026, 12:00", "Barcelona Airport T1"],
    category: "UTILITY",
    language: "en",
  },
  {
    name: "elitebcn_driver_new_job",
    event: "DRIVER_NEW_JOB",
    to: "driver",
    purpose: "To the chauffeur when a job is given to them: the job, the extras by name, their own fare and any cash to take. Never the customer's price.",
    fields: ["ref", "pickupTime", "passenger", "passengerPhone", "pickup", "dropoff", "flight", "passengers", "luggage", "children", "vehicleType", "extras", "requests", "fare", "collect"],
    body: [
      "✨ *ELITEBCN | NEW JOB ASSIGNED* ✨",
      "🔖 *Booking Reference:* {{1}}",
      "⏰ *Pick-up Time:* {{2}}",
      "👤 *Passenger:* {{3}}",
      "📞 *Passenger Phone:* {{4}}",
      "📍 *Pick-up Location:* {{5}}",
      "🏁 *Drop-off Location:* {{6}}",
      "✈️ *Flight Number:* {{7}}",
      "👥 *Passengers:* {{8}}",
      "🧳 *Luggage:* {{9}}",
      "👶 *Children:* {{10}}",
      "🚘 *Vehicle Type:* {{11}}",
      "➕ *Extras:* {{12}}",
      "⭐ *Special Requests:* {{13}}",
      RULE,
      "💶 *Your Fare:* {{14}}",
      "💳 *Payment On The Day:* {{15}}",
      RULE,
      "🤝 *Thank you for driving with EliteBCN.*",
      "✨ *Premium Transfers • Professional Service*",
    ].join("\n"),
    examples: ["EBC-4821", "14 Oct 2026, 12:00", "Ana Smith", "+34 600 123 456", "Barcelona Airport T1", "Hotel Arts, Carrer de la Marina 19", "VY1875", "3", "2", "None", "Business", "Child Seat", "None", "€50", "Paid online, nothing to collect"],
    category: "UTILITY",
    language: "en",
  },
  {
    name: "elitebcn_job_completed",
    event: "RATE_RIDE",
    to: "customer",
    purpose: "Sent once when the journey is completed, with the link to rate it.",
    fields: ["ref", "pickup", "dropoff", "name", "link"],
    body: [
      "✨ *ELITEBCN | JOURNEY COMPLETED* ✨",
      "🔖 *Booking Reference:* {{1}}",
      "📍 *From:* {{2}}",
      "🏁 *To:* {{3}}",
      RULE,
      "Thank you for travelling with us, {{4}}. You can rate your journey here: {{5}}",
      RULE,
      SIGN_OFF,
    ].join("\n"),
    examples: ["EBC-4821", "Barcelona Airport T1", "Hotel Arts, Carrer de la Marina 19", "Ana", "https://www.elitebcn.info/review?booking=abc123"],
    category: "UTILITY",
    language: "en",
  },
  {
    name: "elitebcn_booking_cancelled",
    event: "BOOKING_CANCELLED",
    to: "customer",
    purpose: "Sent once when a paid booking is cancelled.",
    fields: ["ref", "when", "pickup", "dropoff", "name"],
    body: [
      "✨ *ELITEBCN | BOOKING CANCELLED* ✨",
      "🔖 *Booking Reference:* {{1}}",
      "📅 *Date & Time:* {{2}}",
      "📍 *Pick-up Location:* {{3}}",
      "🏁 *Drop-off Location:* {{4}}",
      RULE,
      "Hello {{5}}, this booking has been cancelled. Any refund due under our cancellation policy is returned to your original payment method. Reply to this message if you have a question.",
      RULE,
      SIGN_OFF,
    ].join("\n"),
    examples: ["EBC-4821", "14 Oct 2026, 12:00", "Barcelona Airport T1", "Hotel Arts, Carrer de la Marina 19", "Ana"],
    category: "UTILITY",
    language: "en",
  },
  {
    name: "elitebcn_driver_job_cancelled",
    event: "DRIVER_JOB_CANCELLED",
    to: "driver",
    purpose: "To the chauffeur when a job they were given is cancelled.",
    fields: ["ref", "when", "passenger", "pickup"],
    body: [
      "✨ *ELITEBCN | JOB CANCELLED* ✨",
      "🔖 *Booking Reference:* {{1}}",
      "📅 *Date & Time:* {{2}}",
      "👤 *Passenger:* {{3}}",
      "📍 *Pick-up Location:* {{4}}",
      RULE,
      "This job has been cancelled. Please do not attend the pick-up. Reply to this message if you have a question.",
      RULE,
      "🤝 *Thank you for driving with EliteBCN.*",
      "✨ *Premium Transfers • Professional Service*",
    ].join("\n"),
    examples: ["EBC-4821", "14 Oct 2026, 12:00", "Ana Smith", "Barcelona Airport T1"],
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
