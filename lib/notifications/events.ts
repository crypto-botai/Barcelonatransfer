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
  "FLIGHT_DELAYED_DRIVER",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "RIDE_ON_BOARD",
  "RIDE_COMPLETED",
  "REVIEW_REQUEST",
  "BOOKING_CANCELLED",
  "TRIP_MESSAGE",
  "DRIVER_WAITING",
  "RIDE_TODAY",
  "RATE_RIDE",
  "DRIVER_NEW_JOB",
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

  /**
   * The same delay, told to the driver.
   *
   * Separate from the customer event because the customer is being reassured
   * ("no action needed") while the driver is being given an instruction — a new
   * time to be at arrivals. Sending the customer's wording to a driver would
   * tell them to do nothing about a pickup that has moved.
   *
   * The customer copy promises "your driver has been updated"; this is what
   * makes that promise true.
   */
  FLIGHT_DELAYED_DRIVER: {
    // Email added because the other three do not reach a driver who is not
    // looking at the portal: WhatsApp is unconfigured on this deployment, and
    // push is recorded but not yet delivered. A driver who does not learn of a
    // ninety-minute delay waits at arrivals for it, which is the exact cost
    // this feature exists to avoid.
    channels: ["inapp", "email", "whatsapp", "push"],
    copy: {
      en: { title: "Pickup moved — flight {{flight}} delayed", body: "Booking {{code}}: {{passenger}} now lands {{when}}. Collect from {{pickup}} at the new time." },
      es: { title: "Recogida aplazada — vuelo {{flight}} con retraso", body: "Reserva {{code}}: {{passenger}} aterriza ahora a las {{when}}. Recoger en {{pickup}} a la nueva hora." },
      fr: { title: "Prise en charge décalée — vol {{flight}} retardé", body: "Réservation {{code}} : {{passenger}} atterrit désormais à {{when}}. Récupération à {{pickup}} à la nouvelle heure." },
      de: { title: "Abholung verschoben — Flug {{flight}} verspätet", body: "Buchung {{code}}: {{passenger}} landet jetzt {{when}}. Abholung an {{pickup}} zur neuen Zeit." },
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


  /**
   * The passenger is in the car and moving. Sent because it is the moment a
   * customer stops worrying about whether the driver turned up, and because it
   * timestamps the start of the journey for anyone tracking from home.
   */
  RIDE_ON_BOARD: {
    channels: ["inapp", "whatsapp", "push"],
    copy: {
      en: { title: "Your journey has started", body: "You are on board with {driver}. Next stop: {dropoff}." },
      es: { title: "Su trayecto ha comenzado", body: "Está a bordo con {driver}. Próxima parada: {dropoff}." },
      fr: { title: "Votre trajet a commencé", body: "Vous êtes à bord avec {driver}. Prochain arrêt : {dropoff}." },
      de: { title: "Ihre Fahrt hat begonnen", body: "Sie sind mit {driver} unterwegs. Nächster Halt: {dropoff}." },
    },
  },

  RIDE_COMPLETED: {
    channels: ["inapp", "push"],
    copy: {
      en: { title: "Trip completed",             body: "Thank you for travelling with Elite BCN. Booking {{code}}." },
      es: { title: "Viaje completado",           body: "Gracias por viajar con Elite BCN. Reserva {{code}}." },
      fr: { title: "Trajet terminé",             body: "Merci d'avoir voyagé avec Elite BCN. Réservation {{code}}." },
      de: { title: "Fahrt abgeschlossen",        body: "Danke, dass Sie mit Elite BCN gefahren sind. Buchung {{code}}." },
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

  DRIVER_WAITING: {
    channels: ["inapp", "push"],
    copy: {
      en: { title: "Your chauffeur is waiting",  body: "{{driver}} is at the pick-up point for {{code}}. Open to see where, or message them." },
      es: { title: "Tu chófer te está esperando", body: "{{driver}} está en el punto de recogida de {{code}}. Abre para ver dónde o escríbele." },
      fr: { title: "Votre chauffeur vous attend", body: "{{driver}} est au point de prise en charge pour {{code}}." },
      de: { title: "Ihr Chauffeur wartet",        body: "{{driver}} ist am Abholpunkt für {{code}}." },
    },
  },

  RIDE_TODAY: {
    channels: ["inapp", "push"],
    copy: {
      en: { title: "Your transfer is today",     body: "{{when}} from {{pickup}}. Your chauffeur's details will follow here." },
      es: { title: "Tu traslado es hoy",          body: "{{when}} desde {{pickup}}. Los datos de tu chófer llegarán aquí." },
      fr: { title: "Votre transfert est aujourd'hui", body: "{{when}} depuis {{pickup}}." },
      de: { title: "Ihr Transfer ist heute",      body: "{{when}} ab {{pickup}}." },
    },
  },

  RATE_RIDE: {
    channels: ["inapp", "push"],
    copy: {
      en: { title: "How was your journey?",       body: "Rate your chauffeur and Elite BCN. It takes ten seconds." },
      es: { title: "¿Qué tal el viaje?",          body: "Valora a tu chófer y a Elite BCN. Diez segundos." },
      fr: { title: "Comment s'est passé le trajet ?", body: "Notez votre chauffeur et Elite BCN." },
      de: { title: "Wie war die Fahrt?",          body: "Bewerten Sie Ihren Chauffeur und Elite BCN." },
    },
  },

  DRIVER_NEW_JOB: {
    channels: ["inapp", "push"],
    copy: {
      en: { title: "New job: {{when}}",           body: "{{pickup}} to {{dropoff}}. Open your portal for the details." },
      es: { title: "Nuevo servicio: {{when}}",    body: "{{pickup}} a {{dropoff}}. Abre tu portal para ver los detalles." },
      fr: { title: "Nouvelle course : {{when}}",  body: "{{pickup}} vers {{dropoff}}." },
      de: { title: "Neuer Auftrag: {{when}}",     body: "{{pickup}} nach {{dropoff}}." },
    },
  },

  TRIP_MESSAGE: {
    channels: ["inapp", "push"],
    copy: {
      en: { title: "Message from {{from}}",       body: "{{text}}" },
      es: { title: "Mensaje de {{from}}",         body: "{{text}}" },
      fr: { title: "Message de {{from}}",         body: "{{text}}" },
      de: { title: "Nachricht von {{from}}",      body: "{{text}}" },
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
