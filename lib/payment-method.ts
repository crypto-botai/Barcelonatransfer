/**
 * How a booking is paid.
 *
 * Website bookings are always CARD_LINK: the customer paid at checkout. The
 * other three exist for bookings the office makes by hand — over the phone or
 * on WhatsApp — where the money arrives some other way and someone in the
 * office marks it received.
 */
export type BookingPaymentMethod = "CARD_LINK" | "WHATSAPP" | "CASH" | "BANK_TRANSFER";

export const PAYMENT_METHODS: BookingPaymentMethod[] = ["CARD_LINK", "WHATSAPP", "CASH", "BANK_TRANSFER"];

export const PAYMENT_METHOD_LABELS: Record<BookingPaymentMethod, string> = {
  CARD_LINK:     "Card link",
  WHATSAPP:      "WhatsApp / Bizum",
  CASH:          "Cash to chauffeur",
  BANK_TRANSFER: "Bank transfer",
};

/** Short form for lists and badges. */
export const PAYMENT_METHOD_SHORT: Record<BookingPaymentMethod, string> = {
  CARD_LINK:     "Card",
  WHATSAPP:      "WhatsApp",
  CASH:          "Cash",
  BANK_TRANSFER: "Transfer",
};

/**
 * The sentence the customer reads under the fare in their confirmation.
 * Kept here, next to the method, so the email and the admin form can never
 * disagree about what each method means.
 */
export function paymentLine(method: BookingPaymentMethod, paid: boolean, amount: number): string {
  const eur = `€${amount.toFixed(2)}`;
  if (paid) {
    return method === "CASH"
      ? `${eur} received in cash — thank you.`
      : `${eur} received — thank you. Nothing more to pay.`;
  }
  switch (method) {
    case "CARD_LINK":     return `Pay ${eur} securely by card using the button below. Your booking is held for you meanwhile.`;
    case "WHATSAPP":      return `${eur} to be settled by Bizum or transfer, as arranged on WhatsApp.`;
    case "CASH":          return `Please pay ${eur} in cash to your chauffeur on the day. No card needed.`;
    case "BANK_TRANSFER": return `Please pay ${eur} by bank transfer, quoting your booking reference. Bank details follow separately.`;
  }
}
