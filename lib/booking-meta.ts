import { EXTRAS_CATALOG } from "@/types";

/**
 * Reads the metadata block stored on a booking's specialRequests field.
 *
 * Bookings carry more than the schema has columns for — the booking type, the
 * hours for an hourly hire, the extras chosen and what they cost — and those
 * are written into specialRequests as a `[META]{…}[/META]` prefix ahead of the
 * customer's own note.
 *
 * Nothing read them back. The admin drawer parsed the block but used only
 * `bookingType`; both the admin alert and the driver assignment email stripped
 * it with a regex and kept the remaining text. So a customer could pay €5 for
 * a baby seat and no one in the business was ever told: not the admin viewing
 * the booking, and not the driver who had to bring the seat.
 *
 * One parser, used by all of them.
 */

export interface BookingExtraLine {
  id:       string;
  label:    string;
  price:    number;
  quantity: number;
}

export interface BookingMeta {
  bookingType:   string | null;
  durationHours: number | null;
  extras:        BookingExtraLine[];
  extrasCost:    number;
  memberTier:    string | null;
  /** True when the customer asked for an invoice and so was charged VAT. */
  needsInvoice:  boolean;
  /** Total before VAT. Null on bookings taken before VAT was collected up front. */
  netAmount:     number | null;
  /** VAT collected at booking. 0 when no invoice was requested. */
  vatAmount:     number;
  /** The customer's own note, with the metadata block removed. */
  notes:         string | null;
}

const META_RE = /\[META\]([\s\S]*?)\[\/META\]/;
const META_STRIP_RE = /\[META\][\s\S]*?\[\/META\]\n?/;

const EMPTY: BookingMeta = {
  bookingType: null,
  durationHours: null,
  extras: [],
  extrasCost: 0,
  memberTier: null,
  needsInvoice: false,
  netAmount: null,
  vatAmount: 0,
  notes: null,
};

/** The customer's note with the metadata block taken out. */
export function stripMeta(specialRequests?: string | null): string | null {
  if (!specialRequests) return null;
  return specialRequests.replace(META_STRIP_RE, "").trim() || null;
}

export function parseBookingMeta(specialRequests?: string | null): BookingMeta {
  if (!specialRequests) return EMPTY;

  const notes = stripMeta(specialRequests);
  const match = specialRequests.match(META_RE);
  if (!match) return { ...EMPTY, notes };

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    // A malformed block must not take the booking view down with it — the rest
    // of the record is still worth showing.
    return { ...EMPTY, notes };
  }

  return {
    bookingType:   typeof raw.bookingType === "string" ? raw.bookingType : null,
    durationHours: typeof raw.durationHours === "number" ? raw.durationHours : null,
    memberTier:    typeof raw.memberTier === "string" ? raw.memberTier : null,
    extras:        normaliseExtras(raw.extras),
    extrasCost:    typeof raw.extrasCost === "number" ? raw.extrasCost : 0,
    // Bookings taken before VAT was collected at checkout carry neither field.
    // They are VAT-exclusive, which is what these defaults say.
    needsInvoice:  raw.needsInvoice === true,
    netAmount:     typeof raw.netAmount === "number" ? raw.netAmount : null,
    vatAmount:     typeof raw.vatAmount === "number" ? raw.vatAmount : 0,
    notes,
  };
}

/**
 * Turns whatever was stored into clean extra lines.
 *
 * The label is taken from the catalogue by id where possible, so a line always
 * reads as the current product name rather than whatever the client called it
 * when the booking was made. A line with no recognisable id is still kept —
 * losing an extra the customer paid for is worse than showing an odd label.
 */
function normaliseExtras(value: unknown): BookingExtraLine[] {
  if (!Array.isArray(value)) return [];
  const out: BookingExtraLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const id = typeof e.id === "string" ? e.id : "";
    const known = EXTRAS_CATALOG.find((c) => c.id === id);
    const label = known?.label ?? (typeof e.label === "string" ? e.label : id || "Extra");
    const quantity = typeof e.quantity === "number" && e.quantity > 0 ? e.quantity : 1;
    const price = typeof e.price === "number" ? e.price : known?.price ?? 0;
    if (!id && !label) continue;
    out.push({ id, label, price, quantity });
  }
  return out;
}

/** One line per extra, e.g. "Baby Seat x2 — €10". */
export function formatExtraLine(e: BookingExtraLine): string {
  const qty = e.quantity > 1 ? ` ×${e.quantity}` : "";
  const total = e.price * e.quantity;

  // A percentage extra has no fixed price, so "included" would be wrong — the
  // invoice request costs 10% of the fare, and reading it as free is the one
  // way this line could mislead.
  const known = EXTRAS_CATALOG.find((c) => c.id === e.id);
  if (known?.percentOfSubtotal) {
    return `${e.label} — +${known.percentOfSubtotal}%`;
  }

  // A waived extra reads as included rather than as €0, which looks like a bug.
  const cost = total > 0 ? ` — €${total.toFixed(2)}` : " — included";
  return `${e.label}${qty}${cost}`;
}

/** All extras on one line, for an email row or a summary. */
export function formatExtras(extras: BookingExtraLine[]): string {
  return extras.map(formatExtraLine).join(", ");
}
