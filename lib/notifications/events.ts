/**
 * Notification event catalogue.
 *
 * One entry per thing that can happen to a booking. Each entry owns:
 *   - which channels it goes out on by default
 *   - the customer-facing copy, in the four languages the booking flow serves
 *
 * Copy lives here rather than in the caller so that a wording change is one
 * edit in one file instead of a hunt through cron jobs and API routes.
 */

export const NOTIFICATION_EVENTS = [
  "BOOKING_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_FAILED",
  "DRIVER_ASSIGNED",
  "PICKUP_REMINDER",
  "FLIGHT_DELAYED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "RIDE_COMPLETED",
  "REVIEW_REQUEST",
  "BOOKING_CANCELLED",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

/** `push` is accepted and recorded now; delivery lands with the PWA work. */
export type Channel = "inapp" | "email" | "whatsapp" | "push";

export type Locale = "en" | "es" | "fr" | "de";

const LOCALES: readonly Locale[] = ["en", "es", "fr", "de"];

export interface Copy {
  title: string;
  body: string;
}

interface EventDef {
  channels: Channel[];
  copy: Record<Locale, Copy>;
}

/**
 * `{{name}}` placeholders are filled from the `vars` passed to notify().
 * An unmatched placeholder is dropped rather than printed raw — a customer
 * should never receive a message containing a literal `{{code}}`.
 */
export const EVENT_DEFS: Record<NotificationEvent, EventDef> = {
  BOOKING_CONFIRMED: {
    channels: ["inapp", "email", "whatsapp"],
    copy: {
      en: { title: "Booking confirmed",          body: "Your transfer {{code}} on {{when}} is confirmed. {{route}}" },
      es: { title: "Reserva confirmada",         body: "Tu traslado {{code}} del {{when}} está confirmado. {{route}}" },
      fr: { title: "Réservation confirmée",      body: "Votre transfert {{code}} du {{when}} est confirmé. {{route}}" },
      de: { title: "Buchung bestätigt",          body: "Ihr Transfer {{code}} am {{when}} ist bestätigt. {{route}}" },
    },
  },

  PAYMENT_RECEIVED: {
    channels: ["inapp", "email"],
    copy: {
      en: { title: "Payment received",           body: "We received €{{amount}} for booking {{code}}. Thank you." },
      es: { title: "Pago recibido",              body: "Hemos recibido {{amount}} € por la reserva {{code}}. Gracias." },
      fr: { title: "Paiement reçu",              body: "Nous avons reçu {{amount}} € pour la réservation {{code}}. Merci." },
      de: { title: "Zahlung erhalten",           body: "Wir haben {{amount}} € für Buchung {{code}} erhalten. Vielen Dank." },
    },
  },

  PAYMENT_FAILED: {
    channels: ["inapp", "email"],
    copy: {
      en: { title: "Payment could not be processed", body: "Payment for booking {{code}} did not go through. Your seat is held — please try again." },
      es: { title: "No se pudo procesar el pago",    body: "El pago de la reserva {{code}} no se completó. Mantenemos tu reserva — inténtalo de nuevo." },
      fr: { title: "Paiement non abouti",            body: "Le paiement de la réservation {{code}} n'a pas abouti. Votre place est réservée — merci de réessayer." },
      de: { title: "Zahlung fehlgeschlagen",         body: "Die Zahlung für Buchung {{code}} war nicht erfolgreich. Ihre Buchung bleibt reserviert — bitte erneut versuchen." },
    },
  },

  DRIVER_ASSIGNED: {
    channels: ["inapp", "email", "whatsapp"],
    copy: {
      en: { title: "Your driver is assigned",    body: "{{driver}} will collect you on {{when}}. Booking {{code}}." },
      es: { title: "Conductor asignado",         body: "{{driver}} te recogerá el {{when}}. Reserva {{code}}." },
      fr: { title: "Chauffeur assigné",          body: "{{driver}} viendra vous chercher le {{when}}. Réservation {{code}}." },
      de: { title: "Fahrer zugewiesen",          body: "{{driver}} holt Sie am {{when}} ab. Buchung {{code}}." },
    },
  },

  PICKUP_REMINDER: {
    channels: ["inapp", "email", "whatsapp", "push"],
    copy: {
      en: { title: "Your transfer is tomorrow",  body: "Pickup {{when}} — {{route}}. Booking {{code}}." },
      es: { title: "Tu traslado es mañana",      body: "Recogida {{when}} — {{route}}. Reserva {{code}}." },
      fr: { title: "Votre transfert est demain", body: "Prise en charge {{when}} — {{route}}. Réservation {{code}}." },
      de: { title: "Ihr Transfer ist morgen",    body: "Abholung {{when}} — {{route}}. Buchung {{code}}." },
    },
  },

  FLIGHT_DELAYED: {
    channels: ["inapp", "email", "whatsapp", "push"],
    copy: {
      en: { title: "Flight {{flight}} is delayed", body: "New landing time {{when}}. Your driver has been updated — no extra charge, no action needed." },
      es: { title: "El vuelo {{flight}} va con retraso", body: "Nueva hora de llegada {{when}}. Tu conductor ya está avisado — sin coste adicional." },
      fr: { title: "Le vol {{flight}} est retardé", body: "Nouvelle heure d'atterrissage {{when}}. Votre chauffeur est informé — sans frais supplémentaires." },
      de: { title: "Flug {{flight}} ist verspätet", body: "Neue Landezeit {{when}}. Ihr Fahrer ist informiert — ohne Zusatzkosten." },
    },
  },

  DRIVER_EN_ROUTE: {
    channels: ["inapp", "whatsapp", "push"],
    copy: {
      en: { title: "Your driver is on the way",  body: "{{driver}} is heading to {{pickup}}. Track live: {{link}}" },
      es: { title: "Tu conductor está en camino", body: "{{driver}} se dirige a {{pickup}}. Sigue el trayecto: {{link}}" },
      fr: { title: "Votre chauffeur arrive",     body: "{{driver}} se dirige vers {{pickup}}. Suivi en direct : {{link}}" },
      de: { title: "Ihr Fahrer ist unterwegs",   body: "{{driver}} fährt zu {{pickup}}. Live verfolgen: {{link}}" },
    },
  },

  DRIVER_ARRIVED: {
    channels: ["inapp", "whatsapp", "push"],
    copy: {
      en: { title: "Your driver has arrived",    body: "{{driver}} is waiting at {{pickup}}." },
      es: { title: "Tu conductor ha llegado",    body: "{{driver}} te espera en {{pickup}}." },
      fr: { title: "Votre chauffeur est arrivé", body: "{{driver}} vous attend à {{pickup}}." },
      de: { title: "Ihr Fahrer ist eingetroffen", body: "{{driver}} wartet an {{pickup}}." },
    },
  },

  RIDE_COMPLETED: {
    channels: ["inapp"],
    copy: {
      en: { title: "Trip completed",             body: "Thank you for travelling with Élite BCN. Booking {{code}}." },
      es: { title: "Viaje completado",           body: "Gracias por viajar con Élite BCN. Reserva {{code}}." },
      fr: { title: "Trajet terminé",             body: "Merci d'avoir voyagé avec Élite BCN. Réservation {{code}}." },
      de: { title: "Fahrt abgeschlossen",        body: "Danke, dass Sie mit Élite BCN gefahren sind. Buchung {{code}}." },
    },
  },

  REVIEW_REQUEST: {
    channels: ["inapp", "email"],
    copy: {
      en: { title: "How was your journey?",      body: "We'd love a quick review of your {{route}} transfer." },
      es: { title: "¿Qué tal tu viaje?",         body: "Nos encantaría una breve reseña de tu traslado {{route}}." },
      fr: { title: "Comment s'est passé votre trajet ?", body: "Un court avis sur votre transfert {{route}} nous aiderait beaucoup." },
      de: { title: "Wie war Ihre Fahrt?",        body: "Über eine kurze Bewertung Ihres Transfers {{route}} würden wir uns freuen." },
    },
  },

  BOOKING_CANCELLED: {
    channels: ["inapp", "email", "whatsapp"],
    copy: {
      en: { title: "Booking cancelled",          body: "Booking {{code}} has been cancelled. Any refund due is processed to the original card." },
      es: { title: "Reserva cancelada",          body: "La reserva {{code}} ha sido cancelada. El reembolso, si procede, se abona a la tarjeta original." },
      fr: { title: "Réservation annulée",        body: "La réservation {{code}} a été annulée. Tout remboursement dû est versé sur la carte d'origine." },
      de: { title: "Buchung storniert",          body: "Buchung {{code}} wurde storniert. Eine etwaige Erstattung erfolgt auf die ursprüngliche Karte." },
    },
  },
};

/** Narrows any incoming language string to a locale we have copy for. */
export function resolveLocale(input?: string | null): Locale {
  const short = (input ?? "en").slice(0, 2).toLowerCase() as Locale;
  return LOCALES.includes(short) ? short : "en";
}

/**
 * Fills `{{placeholders}}`. Missing keys collapse to an empty string and the
 * resulting double spaces are squeezed, so a partial `vars` object degrades to
 * a shorter sentence rather than a broken one.
 */
export function render(template: string, vars: Record<string, string | number> = {}): string {
  return template
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const v = vars[key];
      return v === undefined || v === null ? "" : String(v);
    })
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

export function copyFor(
  event: NotificationEvent,
  locale: Locale,
  vars: Record<string, string | number> = {},
): Copy {
  const def = EVENT_DEFS[event];
  const raw = def.copy[locale] ?? def.copy.en;
  return { title: render(raw.title, vars), body: render(raw.body, vars) };
}
