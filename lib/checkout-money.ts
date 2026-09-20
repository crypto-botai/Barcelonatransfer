/**
 * Deposit bookings, cancellation protection and the return-trip discount —
 * the arithmetic only, with no server imports, so the checkout page can run
 * the same figures the API stores.
 *
 * Three options a customer can take at the checkout, all of them money, so
 * every figure is computed here and stored on the booking rather than
 * recalculated at each step: a percentage re-applied to a rounded figure
 * drifts, and a customer who is charged a balance that does not match their
 * receipt will dispute it.
 *
 *   Deposit    — pay 30% now, the rest to the chauffeur on the day.
 *   Protection — 20% of the fare, never refunded, and it lets the customer
 *                cancel up to two hours before pickup for a full refund of
 *                everything else. Without it the free window is 24 hours.
 *   Return     — 5% off a journey booked from the "book your return" link on
 *                a paid booking's confirmation.
 */

/** Share of the fare taken up front on a deposit booking. */
export const DEPOSIT_PERCENT = 30;

/**
 * Below this a deposit is not offered. Zero: the owner wants the option on
 * every fare — a €15 deposit on a €50 airport run is exactly the case it is
 * for, since the customer will not put €50 on a card for a site they found
 * ten minutes ago, but will put €15.
 */
export const DEPOSIT_MIN_FARE = 0;

/** Cancellation protection, as a share of the fare. */
export const PROTECTION_PERCENT = 20;

/** With protection, a cancellation this close to pickup is still refunded. */
export const PROTECTION_CUTOFF_HOURS = 2;

/** Without protection, this is the free-cancellation window. */
export const FREE_CANCEL_HOURS = 24;

/** Off the fare of a return journey booked from a paid booking's link. */
export const RETURN_DISCOUNT_PERCENT = 5;

export type PayOption = "FULL" | "DEPOSIT";

export interface DepositSplit {
  deposit: number;
  balance: number;
  total: number;
  percent: number;
}

export function isDepositEligible(total: number): boolean {
  return total >= DEPOSIT_MIN_FARE && total > 0;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/**
 * Whole euros. Fares on this site are whole numbers and every price on it is
 * shown without cents, so a percentage of a fare is rounded to the euro
 * rather than producing a €28.50 that the page would display as €29.
 */
const r0 = (n: number) => Math.round(n);

/**
 * Splits a fare into deposit and balance.
 *
 * The balance is derived by subtraction, never by a second percentage, so the
 * two parts always add back to exactly the total no matter how the rounding
 * falls.
 */
export function splitDeposit(total: number, percent = DEPOSIT_PERCENT): DepositSplit {
  const pct = Math.min(100, Math.max(0, percent));
  const gross = r2(total);
  const deposit = r0(gross * (pct / 100));
  const balance = r2(gross - deposit);
  return { deposit, balance, total: gross, percent: pct };
}

/** The protection fee on a fare (fare + extras, after any discount, before VAT). */
export function protectionFeeFor(netFare: number): number {
  return r0(Math.max(0, netFare) * (PROTECTION_PERCENT / 100));
}

/** The return-trip discount on the same base a coupon comes off. */
export function returnDiscountFor(discountable: number): number {
  return r0(Math.max(0, discountable) * (RETURN_DISCOUNT_PERCENT / 100));
}

export interface PaymentPlanInput {
  /** Fare + extras − discounts. What VAT and the protection fee are computed on. */
  net: number;
  vat: number;
  tip: number;
  protection: boolean;
  option: PayOption;
}

export interface PaymentPlan {
  /** Fee for protection, 0 when not taken. */
  protectionFee: number;
  /** Everything: net + VAT + tip + protection. What the booking is worth. */
  total: number;
  /** Charged at the checkout today. */
  payNow: number;
  /** Paid to the chauffeur on the day. 0 on a full payment. */
  balance: number;
  option: PayOption;
}

/**
 * What is charged now and what is left for the chauffeur.
 *
 * The protection fee is always paid in full up front, even on a deposit —
 * it is the one part of the price that is never refunded, so it cannot sit
 * in a balance the customer may never pay. The 30% applies to the rest.
 */
export function paymentPlan(i: PaymentPlanInput): PaymentPlan {
  const protectionFee = i.protection ? protectionFeeFor(i.net) : 0;
  const splittable = r2(i.net + i.vat + i.tip);
  const total = r2(splittable + protectionFee);
  if (i.option === "DEPOSIT" && isDepositEligible(splittable)) {
    const s = splitDeposit(splittable);
    return { protectionFee, total, payNow: r2(s.deposit + protectionFee), balance: s.balance, option: "DEPOSIT" };
  }
  return { protectionFee, total, payNow: total, balance: 0, option: "FULL" };
}

export interface RefundPolicyInput {
  pickupDatetime: Date;
  /** What the customer has actually paid online so far. */
  paidAmount: number;
  protectionFee: number | null | undefined;
  now?: Date;
}

export type RefundDecision =
  | { allowed: true; refund: number; kept: number; rule: "free-24h" | "protected-2h" }
  | { allowed: false; rule: "inside-24h" | "inside-2h"; hoursLeft: number };

/**
 * Whether a cancellation is accepted, and what comes back.
 *
 * Protected: allowed up to two hours before pickup; the fee stays, the rest
 * is refunded. Unprotected: allowed up to 24 hours before; everything is
 * refunded. Inside those windows the office handles it by hand, which is
 * what the caller's error message says.
 */
export function refundPolicy(i: RefundPolicyInput): RefundDecision {
  const now = i.now ?? new Date();
  const hoursLeft = (i.pickupDatetime.getTime() - now.getTime()) / 3_600_000;
  const fee = i.protectionFee ?? 0;
  if (fee > 0) {
    if (hoursLeft < PROTECTION_CUTOFF_HOURS) return { allowed: false, rule: "inside-2h", hoursLeft };
    const refund = r2(Math.max(0, i.paidAmount - fee));
    return { allowed: true, refund, kept: r2(i.paidAmount - refund), rule: "protected-2h" };
  }
  if (hoursLeft < FREE_CANCEL_HOURS) return { allowed: false, rule: "inside-24h", hoursLeft };
  return { allowed: true, refund: r2(i.paidAmount), kept: 0, rule: "free-24h" };
}

/**
 * What the chauffeur has to collect from the passenger, if anything.
 *
 * A deposit booking carries its balance; a cash booking the office took by
 * hand carries the whole fare until someone marks it received.
 */
export function collectDue(b: {
  totalAmount: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  balanceAmount?: number | null;
  balancePaidAt?: Date | string | null;
}): number {
  if (b.balanceAmount && b.balanceAmount > 0 && !b.balancePaidAt) return r2(b.balanceAmount);
  if (b.paymentMethod === "CASH" && b.paymentStatus !== "PAID") return r2(b.totalAmount);
  return 0;
}

/** What has actually been paid online: the deposit on a deposit booking, else the total. */
export function paidOnline(b: { totalAmount: number; depositAmount?: number | null; paymentStatus: string }): number {
  if (b.paymentStatus !== "PAID") return 0;
  return r2(b.depositAmount && b.depositAmount > 0 ? b.depositAmount : b.totalAmount);
}
