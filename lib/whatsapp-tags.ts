/**
 * The payment tag shown on a WhatsApp conversation.
 *
 * The office answers customers differently depending on where their money is:
 * someone who has not paid is chased for a payment link, someone who paid 30%
 * is told the balance goes to the chauffeur, someone paying cash is reassured
 * about the amount to bring. Showing it beside the name saves opening the
 * booking to find out.
 *
 * Pure: it only reads facts about a booking. The facts come from the booking
 * the customer's phone number belongs to, which is the next journey they have
 * coming up, or failing that the most recent.
 */

export type PaymentTag = "pending" | "paid" | "deposit" | "cash" | "cancelled";

export interface BookingForTag {
  id: string;
  confirmationCode: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  depositAmount: number | null;
  balanceAmount: number | null;
  balancePaidAt: Date | string | null;
  totalAmount: number;
  pickupDatetime: Date | string;
  guestName?: string | null;
}

export interface TagInfo {
  tag: PaymentTag;
  /** What the badge says. */
  label: string;
  /** A short line with the amount, for the tooltip and the chat header. */
  detail: string | null;
}

export const TAG_ORDER: PaymentTag[] = ["pending", "deposit", "cash", "paid", "cancelled"];

/** What each filter chip is called. */
export const TAG_LABELS: Record<PaymentTag, string> = {
  pending: "Pending payment",
  deposit: "30% paid",
  cash: "Cash to chauffeur",
  paid: "Paid in full",
  cancelled: "Cancelled",
};

/** The tags the office can put on a chat by hand. A booking cannot always say it: a cash deal, or a bank transfer, is agreed in the chat. */
export const MANUAL_TAGS: PaymentTag[] = ["pending", "deposit", "cash", "paid"];

/** What a chosen tag is called, and what it means, for the picker. */
export const MANUAL_TAG_HINTS: Record<PaymentTag, string> = {
  pending: "Waiting for the customer to pay",
  deposit: "30% paid, the balance goes to the chauffeur",
  cash: "The customer pays the chauffeur in cash",
  paid: "Everything is paid",
  cancelled: "The booking was cancelled",
};

export const isPaymentTag = (v: unknown): v is PaymentTag => typeof v === "string" && (TAG_ORDER as string[]).includes(v);

/** The tag a conversation shows, and whether the office chose it or the booking says it. */
export interface ConversationTag extends TagInfo {
  source: "manual" | "booking";
}

export const manualTagInfo = (tag: PaymentTag): ConversationTag => ({ tag, label: TAG_LABELS[tag], detail: MANUAL_TAG_HINTS[tag], source: "manual" });

const euro = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function paymentTag(b: BookingForTag): TagInfo {
  if (b.status === "CANCELLED" || b.status === "REFUNDED") {
    return { tag: "cancelled", label: TAG_LABELS.cancelled, detail: null };
  }

  if (b.paymentStatus === "PAID") {
    const deposit = b.depositAmount ?? 0;
    const balance = b.balanceAmount ?? 0;
    if (deposit > 0 && balance > 0 && !b.balancePaidAt) {
      // The percentage is worked out, not assumed: the checkout's split is 30% today and could change.
      const pct = Math.round((deposit / (deposit + balance)) * 100);
      return { tag: "deposit", label: `${pct}% paid`, detail: `${euro(deposit)} paid, ${euro(balance)} balance due to the chauffeur` };
    }
    return { tag: "paid", label: TAG_LABELS.paid, detail: `${euro(b.totalAmount)} paid` };
  }

  // Not paid. A booking set up to be paid in cash to the chauffeur is a different conversation from one still waiting for a payment link.
  if (b.paymentMethod === "CASH") {
    return { tag: "cash", label: TAG_LABELS.cash, detail: `${euro(b.totalAmount)} to be paid to the chauffeur` };
  }
  return { tag: "pending", label: TAG_LABELS.pending, detail: `${euro(b.totalAmount)} not paid yet` };
}

const at = (v: Date | string) => new Date(v).getTime();

/**
 * Which of a customer's bookings the conversation is about: the next one still
 * to happen, otherwise the most recent. A cancelled booking is only chosen when
 * there is nothing else.
 */
export function relevantBooking<T extends BookingForTag>(bookings: T[], now: Date = new Date()): T | null {
  if (bookings.length === 0) return null;
  const live = bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "REFUNDED");
  const pool = live.length ? live : bookings;
  const upcoming = pool.filter((b) => at(b.pickupDatetime) >= now.getTime()).sort((a, b) => at(a.pickupDatetime) - at(b.pickupDatetime));
  if (upcoming.length) return upcoming[0];
  return [...pool].sort((a, b) => at(b.pickupDatetime) - at(a.pickupDatetime))[0];
}

/** The same number written two ways, so a booking saved without its plus is still found. */
export function phoneVariants(e164: string): string[] {
  const digits = e164.replace(/\D/g, "");
  return [e164, digits, `00${digits}`];
}
