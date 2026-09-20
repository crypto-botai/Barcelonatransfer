import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROUTE_LANDINGS, routeLanding } from "@/lib/route-landings";
import { SLUG_TO_ZONE, routePageHref } from "@/lib/destination-pricing";
import { STATIC_TRANSFER_PAGES } from "@/data/static-transfer-pages";

/**
 * The checkout options — deposit, cancellation protection, the return
 * discount — and the pages added with them. Source-reading guards, like the
 * rest of this directory: they pin the wiring that no unit test reaches.
 */
const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("checkout: what the server stores and charges", () => {
  const route = rd("app/api/bookings/route.ts");

  it("accepts the three options and computes the plan server-side", () => {
    expect(route).toContain(`payOption:       z.enum(["FULL", "DEPOSIT"]).default("FULL")`);
    expect(route).toContain(`protection:      z.boolean().default(false)`);
    expect(route).toContain(`returnOf:        z.string().optional()`);
    expect(route).toContain("const plan = paymentPlan({");
  });

  it("charges the card what is due today, not the total", () => {
    expect(route).toContain("amount:        plan.payNow,");
    expect(route).not.toContain("amount:        totalWithExtras,");
  });

  it("stores the split on the booking so nothing downstream recomputes it", () => {
    expect(route).toContain(`depositAmount:    plan.option === "DEPOSIT" ? plan.payNow : null`);
    expect(route).toContain(`balanceAmount:    plan.option === "DEPOSIT" ? plan.balance : null`);
    expect(route).toContain(`protectionFee:    plan.protectionFee > 0 ? plan.protectionFee : null`);
  });

  it("only gives the return discount on a paid booking that has not already earned one", () => {
    expect(route).toContain(`returnOfBooking.paymentStatus === "PAID"`);
    expect(route).toContain(`"returnDiscountOf":"`);
    expect(route).toContain("returnClaimed === 0");
  });

  it("keeps a round trip on full payment", () => {
    expect(route).toContain(`const payOption: PayOption = returnDatetime ? "FULL" : body.payOption;`);
  });
});

describe("checkout: the browser side", () => {
  const form = rd("app/book/BookFormClient.tsx");

  it("runs the same arithmetic as the server and sends the choices", () => {
    expect(form).toContain(`from "@/lib/checkout-money"`);
    expect(form).toContain("const plan = paymentPlan({");
    expect(form).toContain("protection,\n          payOption: depositAllowed ? payOption : \"FULL\",\n          returnOf: returnOf || undefined,".replace(/\n/g, "\r\n"));
  });

  it("the pay button says what the card is charged today", () => {
    // Both pay buttons (inline and the phone's sticky bar) are the premium
    // button, and both are handed what is due today, never the total.
    expect(form).toContain("<PremiumPayButton");
    expect(form).toContain("amount={quote ? formatCurrency(payNow) : \"\"}");
    expect(form).toContain("amount={formatCurrency(payNow)}");
    expect(form).not.toContain("amount={formatCurrency(grandTotal)}");
    // The button itself: no spinner, a loading label, stills under reduced motion.
    const btn = rd("components/ui/PremiumPayButton.tsx");
    expect(btn).toContain("useReducedMotion");
    expect(btn).toContain("useMotionValue");
    expect(btn).not.toContain("Loader2");
    expect(btn).toContain("aria-busy");
  });

  it("shows the options and the trust block only once there is a price", () => {
    expect(form).toContain("<PaymentOptions");
    expect(form).toContain("<CheckoutTrust protectionTaken={protection} />");
  });

  it("never pulls the server into the client bundle", () => {
    for (const f of ["components/booking/PaymentOptions.tsx", "components/booking/CheckoutTrust.tsx", "lib/checkout-money.ts"]) {
      const s = rd(f);
      expect(s, f).not.toContain("@/lib/prisma");
      expect(s, f).not.toContain("@/lib/sumup");
      expect(s, f).not.toContain("@/lib/deposits");
    }
  });

  it("the trust block uses real reviews, by name, and the real policy figures", () => {
    const trust = rd("components/booking/CheckoutTrust.tsx");
    expect(trust).toContain(`from "@/data/reviews"`);
    expect(trust).toContain("r.verified && r.text");
    expect(trust).toContain("Flight tracked");
    expect(trust).toContain("name board");
    expect(trust).toContain("FREE_CANCEL_HOURS");
  });
});

describe("checkout: everyone downstream reads the split", () => {
  it("the receipt and the pending email carry it", () => {
    const resend = rd("lib/resend.ts");
    expect(resend).toContain("payNow, balanceAmount, protectionFee,");
    expect(rd("lib/payment-completion.ts")).toContain("payNow:           paidOnline(updated)");
    expect(rd("lib/payment-completion.ts")).toContain("amount:          paidOnline(updated)");
  });

  it("the chauffeur and the fleet company are told what to collect", () => {
    const prem = rd("lib/email/premium.ts");
    expect(prem).toContain("function collectPanel(");
    expect(prem).toContain("Collect from the client");
    // The old unconditional claim is gone.
    expect(prem).not.toMatch(/paragraph\("Please read the details below and confirm you can take it\. The client has already paid\."\)/);
    expect(rd("app/api/bookings/[id]/route.ts")).toContain("collectAmount:    collectDue(booking)");
    expect(rd("lib/partner.ts")).toContain("collectAmount: collectDue(booking)");
    expect(rd("components/driver/DriverDashboard.tsx")).toContain("Collect {formatCurrency(collectDue(");
    expect(rd("app/partner/(panel)/jobs/page.tsx")).toContain("Driver collects {euro(collectDue(j))}");
  });

  it("finishing the ride settles the balance, by driver and by company", () => {
    expect(rd("app/api/driver/ride/route.ts")).toContain(`balancePaidAt: now, balancePaidBy: driver.id, balanceMethod: "DRIVER"`);
    expect(rd("lib/partner.ts")).toContain(`balanceMethod: "DRIVER"`);
  });

  it("the office can mark the balance received, and sees the split", () => {
    expect(rd("app/api/admin/bookings/[id]/payment/route.ts")).toContain("balancePaid:   z.boolean().optional()");
    const admin = rd("app/admin/bookings/page.tsx");
    expect(admin).toContain("balance received");
    expect(admin).toContain("Cancellation protection");
  });

  it("an online balance payment is recognised by the webhook", () => {
    expect(rd("app/api/payments/webhook/route.ts")).toContain("balanceCheckoutId: checkoutId");
    expect(rd("lib/payment-completion.ts")).toContain("export async function finalizeBalancePayment(");
  });

  it("the success page shows paid-today and to-the-chauffeur", () => {
    const s = rd("app/booking/success/page.tsx");
    expect(s).toContain("To your chauffeur on the day");
    expect(s).toContain("returnOf: bookingId");
    expect(rd("app/api/payments/verify/route.ts")).toContain("balanceAmount:    booking.balanceAmount");
  });
});

describe("cancellation uses the policy, not a hard-coded 24 hours", () => {
  const cancel = rd("app/api/bookings/[id]/cancel/route.ts");
  it("asks refundPolicy and refunds only the refundable part", () => {
    expect(cancel).toContain("const decision = refundPolicy({");
    expect(cancel).toContain("await refundSumUpTransaction(booking.stripePaymentId, refundAmount)");
    expect(cancel).toContain(`(partial ? "PARTIALLY_REFUNDED" : "REFUNDED")`);
    expect(cancel).not.toContain("hoursUntilPickup < 24");
  });
  it("the FAQ explains both options", () => {
    const faq = rd("lib/faq-data.ts");
    expect(faq).toContain("What is cancellation protection?");
    expect(faq).toContain("Can I pay a deposit instead of the full fare?");
  });
});

describe("the journey home", () => {
  it("is offered three days after a completed one-way ride, once", () => {
    const cron = rd("app/api/cron/daily/route.ts");
    expect(cron).toContain("async function runReturnRebook()");
    expect(cron).toContain(`type: "RETURN_REBOOK"`);
    expect(cron).toContain("returnOfId:  null");
    expect(cron).toContain("returnLeg:   null");
    expect(cron).toContain("runReturnRebook(),");
    expect(rd("lib/email/premium.ts")).toContain("export function returnRebookCard(");
  });
  it("the confirmation and the success page promise the 5%", () => {
    expect(rd("lib/email/premium.ts")).toContain("Book the return now and save 5%.");
    expect(rd("app/booking/success/page.tsx")).toContain("Save 5% on the return.");
  });
});

describe("the four new route pages", () => {
  const slugs = ["cambrils", "calella", "blanes", "roses"];
  it("are registered everywhere a route page must be", () => {
    for (const slug of slugs) {
      expect(routeLanding(slug), slug).toBeDefined();
      expect(SLUG_TO_ZONE[slug], slug).toBe(slug);
      expect(routePageHref("airport", slug), slug).toBe(`/transfers/${slug}`);
      expect(STATIC_TRANSFER_PAGES.some((p) => p.slug === slug), slug).toBe(true);
      expect(rd(`app/transfers/${slug}/page.tsx`)).toContain(`routeLanding("${slug}")`);
      expect(rd("app/sitemap.ts")).toContain(`/transfers/${slug}\``);
      expect(rd("app/transfers/page.tsx")).toContain(`slug: "${slug}"`);
    }
  });
  it("price themselves from the table, never by hand", () => {
    for (const slug of slugs) {
      const r = routeLanding(slug)!;
      expect(r.cheapest).toBeGreaterThan(0);
      expect(r.title).toContain(`€${r.cheapest}`);
      for (const t of r.priceTables) expect(t.vehicles.length, `${slug} ${t.heading}`).toBeGreaterThan(0);
      expect(r.faqs.length).toBeGreaterThanOrEqual(5);
      expect(r.sections.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("only link to pages that exist", () => {
    const links = new Set<string>();
    for (const r of ROUTE_LANDINGS) for (const s of r.sections) for (const p of s.paras) for (const m of p.matchAll(/\]\((\/[^)]+)\)/g)) links.add(m[1]);
    for (const href of links) {
      if (!href.startsWith("/transfers/")) { expect(rd(`app${href}/page.tsx`).length, href).toBeGreaterThan(0); continue; }
      const slug = href.replace("/transfers/", "");
      const exists = routeLanding(slug) || STATIC_TRANSFER_PAGES.some((p) => p.slug === slug) || rd("data/destinations.json").includes(`"slug": "${slug}"`) || existsSync(join(ROOT, "app", "transfers", slug, "page.tsx"));
      expect(exists, href).toBeTruthy();
    }
  });
});
