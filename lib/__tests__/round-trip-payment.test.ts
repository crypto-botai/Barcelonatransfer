import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown> & { id: string };
const store = vi.hoisted(() => ({ rows: [] as Row[] }));

/** Just enough of a where-clause evaluator for the shapes journeys.ts and payment-completion.ts use. */
function match(r: Row, w: Record<string, unknown> | undefined): boolean {
  if (!w) return true;
  return Object.entries(w).every(([k, v]) => {
    if (k === "OR") return (v as Record<string, unknown>[]).some((x) => match(r, x));
    const cur = r[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const o = v as Record<string, unknown>;
      if ("in" in o) return (o.in as unknown[]).includes(cur);
      if ("notIn" in o) return !(o.notIn as unknown[]).includes(cur);
      if ("not" in o) return cur !== o.not;
      if ("contains" in o) return typeof cur === "string" && cur.includes(o.contains as string);
      return true;
    }
    return cur === v;
  });
}

const db = vi.hoisted(() => ({
  booking: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  payment: { upsert: vi.fn(async () => ({})) },
  emailLog: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []), create: vi.fn(async () => ({ id: "c" })), update: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({ count: 0 })) },
  abandonedBooking: { updateMany: vi.fn(async () => ({ count: 0 })) },
  bookingSession: { updateMany: vi.fn(async () => ({ count: 0 })) },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/tracking/openai-conversions", () => ({ sendOpenAiConversion: vi.fn(async () => ({ ok: true, outcome: "sent" })), openAiConversionsConfigured: () => false }));
vi.mock("@/lib/resend", () => ({
  sendPaymentConfirmationEmail: vi.fn(async () => undefined),
  sendJourneysConfirmation: vi.fn(async () => undefined),
  sendAdminNewBookingAlert: vi.fn(async () => undefined),
  sendFailedPaymentEmail: vi.fn(async () => undefined),
}));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsAppBookingConfirmation: vi.fn(async () => undefined) }));
vi.mock("@/lib/notifications/service", () => ({ notify: vi.fn(async () => undefined) }));

import { companionIds, settleCompanions } from "@/lib/journeys";
import { finalizeSumUpPayment } from "@/lib/payment-completion";

const base = (over: Partial<Row>): Row => ({
  id: "x", confirmationCode: "EBC-X", status: "PENDING", paymentStatus: "PENDING", isDeleted: false, specialRequests: null, returnOfId: null,
  totalAmount: 100, depositAmount: null, currency: "EUR", guestEmail: null, ...over,
});

beforeEach(() => {
  store.rows = [
    base({ id: "out", confirmationCode: "EBC-OUT", totalAmount: 120 }),
    base({ id: "ret", confirmationCode: "EBC-RET", returnOfId: "out", totalAmount: 100, specialRequests: "Return leg of booking EBC-OUT." }),
    base({ id: "other", confirmationCode: "EBC-OTHER", totalAmount: 80 }),
  ];
  db.booking.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => store.rows.find((r) => r.id === where.id) ?? null);
  db.booking.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => store.rows.filter((r) => match(r, where)));
  db.booking.updateMany.mockImplementation(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const hit = store.rows.filter((r) => match(r, where));
    hit.forEach((r) => Object.assign(r, data));
    return { count: hit.length };
  });
  db.booking.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const r = store.rows.find((x) => x.id === where.id)!;
    Object.assign(r, data);
    return r;
  });
});

const row = (id: string) => store.rows.find((r) => r.id === id)!;

describe("a round trip is paid with one payment", () => {
  it("the card payment pays and confirms the journey home as well as the outbound", async () => {
    const res = await finalizeSumUpPayment("out", { id: "chk_1", amount: 220, currency: "EUR", status: "PAID", transaction_id: "txn_9", checkout_reference: "out" } as never);
    expect(res).toBe("confirmed");
    expect(row("out")).toMatchObject({ paymentStatus: "PAID", status: "CONFIRMED" });
    expect(row("ret")).toMatchObject({ paymentStatus: "PAID", status: "CONFIRMED" });
    // The charge stays on the outbound booking only, so a refund is never started against it from the return leg.
    expect(row("ret").stripePaymentId).toBeUndefined();
  });

  it("does not touch a booking that has nothing to do with the trip", async () => {
    await finalizeSumUpPayment("out", { id: "chk_1", amount: 220, currency: "EUR", status: "PAID", transaction_id: "txn_9", checkout_reference: "out" } as never);
    expect(row("other")).toMatchObject({ paymentStatus: "PENDING", status: "PENDING" });
  });

  it("a second delivery of the same payment (webhook, verify and the cron all race) changes nothing more", async () => {
    const checkout = { id: "chk_1", amount: 220, currency: "EUR", status: "PAID", transaction_id: "txn_9", checkout_reference: "out" } as never;
    await finalizeSumUpPayment("out", checkout);
    expect(await finalizeSumUpPayment("out", checkout)).toBe("already-paid");
    expect(row("ret")).toMatchObject({ paymentStatus: "PAID" });
  });

  it("rides booked together with it are paid too", async () => {
    store.rows.push(base({ id: "tog", confirmationCode: "EBC-TOG", specialRequests: "Booked together with EBC-OUT." }));
    await finalizeSumUpPayment("out", { id: "chk_1", amount: 300, currency: "EUR", status: "PAID", transaction_id: "txn_9", checkout_reference: "out" } as never);
    expect(row("tog")).toMatchObject({ paymentStatus: "PAID", status: "CONFIRMED" });
  });

  it("a journey that already has a chauffeur keeps its status when it is marked paid", async () => {
    Object.assign(row("ret"), { status: "DRIVER_ASSIGNED" });
    await settleCompanions(row("out") as never, { paid: true });
    expect(row("ret")).toMatchObject({ paymentStatus: "PAID", status: "DRIVER_ASSIGNED" });
  });

  it("a cancelled return is left alone", async () => {
    Object.assign(row("ret"), { status: "CANCELLED" });
    await settleCompanions(row("out") as never, { paid: true });
    expect(row("ret")).toMatchObject({ paymentStatus: "PENDING", status: "CANCELLED" });
  });

  it("a failure while settling never fails the payment", async () => {
    db.booking.findMany.mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(settleCompanions(row("out") as never, { paid: true })).resolves.toBe(0);
    spy.mockRestore();
  });
});

describe("the office marking a payment", () => {
  it("marking the outbound paid pays the return, and undoing it puts the return back to unpaid", async () => {
    expect(await settleCompanions(row("out") as never, { paid: true, paymentMethod: "CASH", markedBy: "Boss" })).toBe(1);
    expect(row("ret")).toMatchObject({ paymentStatus: "PAID", paymentMethod: "CASH", paidMarkedBy: "Boss", status: "CONFIRMED" });
    expect(await settleCompanions(row("out") as never, { paid: false })).toBe(1);
    expect(row("ret")).toMatchObject({ paymentStatus: "PENDING", paidAt: null });
  });

  it("marking the journey home on its own touches nothing else", async () => {
    expect(await settleCompanions(row("ret") as never, { paid: true })).toBe(0);
  });
});

describe("which bookings are companions", () => {
  it("the return leg and rides booked together, never a multi-car split", async () => {
    expect(await companionIds(row("out") as never)).toEqual(["ret"]);
    store.rows.push(base({ id: "car2", confirmationCode: "EBC-C2", returnOfId: "out", specialRequests: "Vehicle 2 of 2." }));
    expect(await companionIds(row("out") as never)).toEqual([]);
    expect(await companionIds(base({ id: "x", specialRequests: "Vehicle 1 of 2." }) as never)).toEqual([]);
  });
});
