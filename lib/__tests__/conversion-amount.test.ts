import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The conversion reports what SumUp charged, not what the booking says.
 *
 * These are the same number for every ordinary booking, because the checkout
 * is created from the same arithmetic the booking row holds. They part
 * company when something rewrites the booking after the checkout exists —
 * the office rescheduling an hourly job, say, which recomputes totalAmount
 * while a checkout for the old figure is still outstanding.
 *
 * In that case the customer's card is charged the old amount and the booking
 * row says the new one. Reporting the booking's figure would report revenue
 * that was never taken, and nobody would notice until the numbers were
 * reconciled months later. So the amount and currency come off the confirmed
 * checkout object, which is what SumUp actually took.
 *
 * This runs the real finalizeSumUpPayment with the database and the network
 * mocked, so it proves the value that reaches the conversion rather than
 * asserting on the shape of the source.
 */

interface SentConversion {
  eventId: string;
  eventType: string;
  amount: number;
  currency: string;
  oppref?: string | null;
  sourceUrl: string;
}

const sendOpenAiConversion = vi.fn(
  async (_input: SentConversion) => ({ ok: true, outcome: "sent" as const }),
);

const db = {
  booking:         { findUnique: vi.fn(), update: vi.fn() },
  payment:         { upsert: vi.fn(async (_args: { create: { amount: number } }) => ({})) },
  emailLog:        {
    findMany:   vi.fn(async () => []),
    create:     vi.fn(async () => ({ id: "claim-1" })),
    findFirst:  vi.fn(async () => ({ id: "claim-1" })),
    update:     vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({ count: 0 })),
  },
  abandonedBooking: { updateMany: vi.fn(async () => ({ count: 0 })) },
  bookingSession:   { updateMany: vi.fn(async () => ({ count: 0 })) },
};

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/tracking/openai-conversions", () => ({
  sendOpenAiConversion: (input: SentConversion) => sendOpenAiConversion(input),
  openAiConversionsConfigured: () => true,
}));
vi.mock("@/lib/resend", () => ({
  sendPaymentConfirmationEmail: vi.fn(async () => undefined),
  sendAdminNewBookingAlert:     vi.fn(async () => undefined),
  sendFailedPaymentEmail:       vi.fn(async () => undefined),
}));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsAppBookingConfirmation: vi.fn(async () => undefined) }));
vi.mock("@/lib/notifications/service", () => ({ notify: vi.fn(async () => undefined) }));

const { finalizeSumUpPayment } = await import("@/lib/payment-completion");

/** A checkout as SumUp reports it once the money is taken. */
const paidCheckout = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "chk_abc",
  checkout_reference: "bk_1",
  amount: 65,
  currency: "EUR",
  status: "PAID" as const,
  transaction_id: "txn_xyz",
  ...over,
});

/** The booking row. `guestEmail: null` stops the run right after the report. */
const bookingRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "bk_1",
  totalAmount: 65,
  depositAmount: null,
  currency: "EUR",
  paymentStatus: "PENDING",
  specialRequests: null,
  guestEmail: null,
  ...over,
});

function arrange(stored: Record<string, unknown>, confirmed: Record<string, unknown>) {
  db.booking.findUnique.mockResolvedValue(stored as never);
  db.booking.update.mockResolvedValue({ ...stored, paymentStatus: "PAID" } as never);
  return finalizeSumUpPayment("bk_1", confirmed as never);
}

const lastConversion = (): SentConversion => {
  const call = sendOpenAiConversion.mock.calls.at(-1);
  if (!call) throw new Error("no conversion was sent");
  return call[0];
};

beforeEach(() => {
  vi.clearAllMocks();
  db.emailLog.findMany.mockResolvedValue([] as never);
  db.emailLog.create.mockResolvedValue({ id: "claim-1" } as never);
  db.emailLog.findFirst.mockResolvedValue({ id: "claim-1" } as never);
});

describe("the amount comes off the confirmed checkout", () => {
  it("reports the charged amount on an ordinary booking", async () => {
    await arrange(bookingRow(), paidCheckout());
    expect(sendOpenAiConversion).toHaveBeenCalledTimes(1);
    expect(lastConversion().amount).toBe(65);
    expect(lastConversion().currency).toBe("EUR");
  });

  /**
   * The case this change exists for: the office reschedules an hourly job
   * after the checkout was created, so totalAmount is rewritten to 120 while
   * SumUp holds — and charges — the original 65.
   */
  it("ignores a totalAmount that changed after the checkout was created", async () => {
    await arrange(
      bookingRow({ totalAmount: 120 }),   // rewritten by a reschedule
      paidCheckout({ amount: 65 }),       // what SumUp actually took
    );
    expect(lastConversion().amount).toBe(65);
    expect(lastConversion().amount).not.toBe(120);
  });

  it("ignores a depositAmount that changed after the checkout was created", async () => {
    await arrange(
      bookingRow({ totalAmount: 200, depositAmount: 80 }),
      paidCheckout({ amount: 60 }),
    );
    expect(lastConversion().amount).toBe(60);
  });

  it("reports the deposit SumUp charged on a deposit booking", async () => {
    await arrange(
      bookingRow({ totalAmount: 200, depositAmount: 60 }),
      paidCheckout({ amount: 60 }),
    );
    expect(lastConversion().amount).toBe(60);
  });

  it("reports the full fare when the whole thing was charged", async () => {
    await arrange(bookingRow({ totalAmount: 140 }), paidCheckout({ amount: 140 }));
    expect(lastConversion().amount).toBe(140);
  });

  it("takes the currency from the checkout, not the booking row", async () => {
    await arrange(
      bookingRow({ currency: "GBP" }),
      paidCheckout({ currency: "EUR" }),
    );
    expect(lastConversion().currency).toBe("EUR");
  });
});

describe("the rest of the conversion is unchanged", () => {
  it("still uses booking.id as the event id", async () => {
    await arrange(bookingRow(), paidCheckout());
    expect(lastConversion().eventId).toBe("bk_1");
  });

  it("still sends the click reference exactly as stored", async () => {
    const oppref = "eyJhbGciOiJIUzI1NiJ9.abc+/=";
    await arrange(
      bookingRow({ specialRequests: `[META]${JSON.stringify({ oppref })}[/META]` }),
      paidCheckout(),
    );
    expect(lastConversion().oppref).toBe(oppref);
  });
});

describe("the PAID gates are untouched", () => {
  it("reports nothing when the booking is already paid", async () => {
    db.booking.findUnique.mockResolvedValue(bookingRow({ paymentStatus: "PAID" }) as never);
    const out = await finalizeSumUpPayment("bk_1", paidCheckout() as never);
    expect(out).toBe("already-paid");
    expect(sendOpenAiConversion).not.toHaveBeenCalled();
  });

  it("reports nothing when the booking does not exist", async () => {
    db.booking.findUnique.mockResolvedValue(null as never);
    const out = await finalizeSumUpPayment("bk_1", paidCheckout() as never);
    expect(out).toBe("not-found");
    expect(sendOpenAiConversion).not.toHaveBeenCalled();
  });

  it("reports nothing when a conversion was already sent", async () => {
    db.emailLog.findMany.mockResolvedValue([
      { id: "old", status: "SENT", createdAt: new Date() },
    ] as never);
    await arrange(bookingRow(), paidCheckout());
    expect(sendOpenAiConversion).not.toHaveBeenCalled();
  });
});

describe("the Payment row keeps its own meaning", () => {
  it("still records what the booking says was paid online, not the checkout", async () => {
    // paidOnline(booking) — deliberately unchanged by this work.
    await arrange(
      bookingRow({ totalAmount: 120 }),
      paidCheckout({ amount: 65 }),
    );
    const call = db.payment.upsert.mock.calls.at(-1);
    if (!call) throw new Error("no payment row was written");
    expect(call[0].create.amount).toBe(120);
  });
});
