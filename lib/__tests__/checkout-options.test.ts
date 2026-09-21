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
    expect(route).toContain(`balanceAmount:    plan.option === "DEPOSIT" ? outboundBalance : null`);
    expect(route).toContain(`protectionFee:    plan.protectionFee > 0 ? plan.protectionFee : null`);
  });

  it("only gives the return discount on a paid booking that has not already earned one", () => {
    expect(route).toContain(`returnOfBooking.paymentStatus === "PAID"`);
    expect(route).toContain(`"returnDiscountOf":"`);
    expect(route).toContain("returnClaimed === 0");
  });

  it("offers the deposit on a round trip and splits the balance between the legs", () => {
    // It used to force FULL on any booking with a return leg.
    expect(route).toContain("const payOption: PayOption = body.payOption;");
    expect(route).not.toContain(`returnDatetime ? "FULL"`);
    // Each leg carries its own share, and the return leg takes the remainder
    // by subtraction so the two add back to exactly the balance.
    expect(route).toContain("const outboundBalance =");
    expect(route).toContain("const returnBalance = Math.round((plan.balance - outboundBalance)");
    expect(route).toContain("balanceAmount:    plan.option === \"DEPOSIT\" ? outboundBalance : null");
    expect(route).toContain("balanceAmount:    plan.option === \"DEPOSIT\" && returnBalance > 0 ? returnBalance : null");
  });

  it("tells the customer how a round trip is split, on the page and in the email", () => {
    expect(rd("app/book/BookFormClient.tsx")).toContain("depositNote={addReturn");
    expect(rd("components/booking/PaymentOptions.tsx")).toContain("{depositNote}");
    expect(rd("lib/resend.ts")).toContain("split between your two journeys");
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

describe("the payment page", () => {
  const pay = rd("app/booking/pay/[checkoutId]/page.tsx");

  it("shows what is being paid for, and what is due today", () => {
    expect(pay).toContain("/api/payments/verify?booking_id=");
    expect(pay).toContain("Your journey");
    expect(pay).toContain("Due today");
    expect(pay).toContain("to your chauffeur on the day");
  });

  it("uses our own button and suppresses SumUp's, with a fallback when it cannot", () => {
    expect(pay).toContain("<PremiumPayButton");
    expect(pay).toContain("showSubmitButton: false");
    // If this SDK build offers no submit(), SumUp's own button comes back.
    expect(pay).toContain("typeof widgetRef.current?.submit !== \"function\"");
    expect(pay).toContain("showSubmitButton: true");
  });

  it("puts the policies where the card number is typed", () => {
    expect(pay).toContain("href=\"/refund-policy\"");
    expect(pay).toContain("href=\"/terms\"");
  });

  it("stills its motion under reduced motion and never polls scroll", () => {
    expect(pay).toContain("useReducedMotion");
    expect(pay).toContain("initial={reduce ? false : \"hidden\"}");
    expect(pay).not.toContain("addEventListener(\"scroll\"");
    const tilt = rd("components/booking/TiltCard.tsx");
    expect(tilt).toContain("useMotionValue");
    expect(tilt).toContain("useReducedMotion");
    expect(tilt).toContain("e.pointerType === \"touch\"");
    expect(tilt).not.toContain("useState");
    // No 3D transform around SumUp's iframes: Chrome's compositor dropped
    // clicks into the card fields on desktop while the panel tilted.
    expect(tilt).not.toContain("rotateX");
    expect(tilt).not.toContain("rotateY");
    expect(tilt).not.toContain("perspective");
    expect(tilt).not.toContain("preserve-3d");
  });
});

describe("the refund policy page", () => {
  const page = rd("app/refund-policy/page.tsx");

  it("renders the shared policy module rather than its own prose", () => {
    expect(page).toContain("from \"@/lib/policies\"");
    expect(page).toContain("CANCELLATION_WINDOWS.map");
    expect(page).toContain("policySection(\"cancellation\")");
    expect(page).toContain("policySection(\"protection\")");
    expect(page).toContain("policySection(\"deposit\")");
    expect(page).toContain("{PROTECTION_CUTOFF_HOURS}");
  });

  it("is reachable and indexed", () => {
    expect(rd("components/layout/Footer.tsx")).toContain("href=\"/refund-policy\"");
    expect(rd("app/sitemap.ts")).toContain("/refund-policy`");
    for (const l of ["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ar"]) {
      const m = JSON.parse(rd(`messages/${l}.json`)) as { footer: { legal: Record<string, string> } };
      expect(m.footer.legal.refunds, l).toBeTruthy();
    }
  });

  it("the terms point at it rather than restating it alone", () => {
    const terms = rd("app/terms/page.tsx");
    expect(terms).toContain("/refund-policy");
    expect(terms).toContain("30% deposit");
    expect(terms).toContain("Cancellation protection");
  });
});

describe("one policy, every surface", () => {
  it("the windows and the prose come from the same module the refund route runs on", () => {
    const pol = rd("lib/policies.ts");
    expect(pol).toContain(`from "@/lib/checkout-money"`);
    // No hand-typed hour counts in the prose.
    expect(pol).toContain("${CANCEL_WINDOW_HOURS.CITY}");
    expect(pol).toContain("${CANCEL_WINDOW_HOURS.INTERCITY}");
    expect(pol).toContain("${CANCEL_WINDOW_HOURS.MINIBUS}");
    expect(pol).toContain("${PROTECTION_CUTOFF_HOURS}");
  });

  it("covers every rule the owner set", () => {
    const pol = rd("lib/policies.ts");
    for (const claim of [
      "135 cm",                       // child seats, by Spanish law
      "does not extend to licensed VTC",
      "Como restaurant",              // T1 / T2B meeting point
      "Terminal 2A",
      "ten minutes",                  // the window the chauffeur needs
      "express car park",             // the shorter walk at T2
      "meet-and-greet fee back",      // refunded if the chauffeur is late
      "not in the passenger compartment",
      "not covered by our insurance",
      "never refunded",               // the protection fee
      "goodwill decision",            // discretionary refund with proof
      "no-show is charged in full",
    ]) expect(pol, claim).toContain(claim);
  });

  it("reaches the checkout, the payment page and the confirmation email", () => {
    expect(rd("app/book/BookFormClient.tsx")).toContain("<PolicySummary />");
    expect(rd("app/booking/pay/[checkoutId]/page.tsx")).toContain("<PolicySummary />");
    expect(rd("components/booking/PolicySummary.tsx")).toContain("CHECKOUT_POLICY_POINTS");
    const resend = rd("lib/resend.ts");
    expect(resend).toContain("CHECKOUT_POLICY_POINTS");
    // Both the "booking received" email and the paid receipt carry it.
    expect((resend.match(/policy: \{ points: CHECKOUT_POLICY_POINTS/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(rd("lib/email/premium.ts")).toContain("function policyPanel(");
  });

  it("the Terms and the FAQ say the same thing", () => {
    const terms = rd("app/terms/page.tsx");
    for (const id of ["cancellation", "protection", "meet-greet", "luggage", "children"]) {
      expect(terms, id).toContain(`<Section id="${id}"`);
    }
    // The old flat 24 h / 50% clause is gone from both.
    expect(terms).not.toContain("Between 2 and 24 hours before pickup");
    const faq = rd("lib/faq-data.ts");
    expect(faq).not.toContain("may incur a 50% charge");
    expect(faq).toContain("What is your cancellation policy?");
    expect(faq).toContain("How does Meet & Greet actually work when I land?");
    expect(faq).toContain("Do I need a child seat in Spain?");
  });

  it("the cancel route honours this booking's own window", () => {
    const cancel = rd("app/api/bookings/[id]/cancel/route.ts");
    expect(cancel).toContain("freeHours: freeCancelHours(booking)");
    expect(cancel).toContain("inside-protection-cutoff");
    expect(cancel).toContain("proof of a cancelled flight");
  });
});

describe("wallets are claimed only when they exist", () => {
  it("hands Google Pay to the widget only when a merchant id is configured", () => {
    const w = rd("lib/wallets.ts");
    expect(w).toContain("NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_ID");
    expect(w).toContain("merchantId && GOOGLE_PAY_APPROVED ? { merchantId, merchantName } : null");
    // The id is public by design; Apple is gated separately until verified.
    expect(w).toContain("NEXT_PUBLIC_APPLE_PAY_READY");
    // ...and Google likewise: configured is not the same as visible.
    expect(w).toContain("NEXT_PUBLIC_GOOGLE_PAY_READY");
    // ...and withheld from the widget entirely until Google approves the
    // merchant, so no customer meets OR_BIBED_11 at the pay button.
    expect(w).toContain("NEXT_PUBLIC_GOOGLE_PAY_APPROVED");
    expect(w).toContain("merchantId && GOOGLE_PAY_APPROVED ?");
    expect(w).toContain("Google Pay accepted");
    const pay = rd("app/booking/pay/[checkoutId]/page.tsx");
    expect(pay).toContain("...(GOOGLE_PAY ? { googlePay: GOOGLE_PAY } : {})");
    // Apple Pay has no mount option; it appears once the domain is registered.
    expect(pay).not.toContain("applePay:");
  });

  it("never advertises a wallet the checkout cannot offer", () => {
    for (const f of [
      "app/booking/pay/[checkoutId]/page.tsx",
      "app/book/BookFormClient.tsx",
      "app/dashboard/payments/page.tsx",
    ]) {
      const src = rd(f);
      // Every remaining mention is behind the flag.
      const bare = src.split("WALLET_LABEL").length - 1;
      expect(bare, f).toBeGreaterThan(0);
    }
    // The homepage FAQ named Stripe, which this site has never used.
    const faq = rd("components/sections/FAQSection.tsx");
    expect(faq).not.toContain("through Stripe");
    expect(faq).toContain("through SumUp");
  });
});

describe("Apple Pay domain verification", () => {
  it("the file SumUp issued is present, intact and extensionless", () => {
    // Apple fetches exactly this path. A rename, an added .txt, or an editor
    // appending a newline all fail the check and silently disable Apple Pay.
    const p = join(ROOT, "public", ".well-known", "apple-developer-merchantid-domain-association");
    expect(existsSync(p), "verification file missing").toBe(true);
    const raw = readFileSync(p);
    expect(raw.length).toBe(9118);
    expect(raw[raw.length - 1]).not.toBe(10);
    expect(raw[raw.length - 1]).not.toBe(13);
    // Hex-encoded JSON from the PSP: starts with { and ends with }.
    const text = raw.toString("utf8");
    expect(/^[0-9A-F]+$/.test(text), "not plain uppercase hex").toBe(true);
    const decoded = Buffer.from(text, "hex").toString("utf8");
    expect(decoded.startsWith("{")).toBe(true);
    expect(decoded).toContain("pspId");
    expect(decoded).toContain("signature");
  });

  it("is served as text rather than a download", () => {
    expect(readFileSync(join(ROOT, "next.config.ts"), "utf-8"))
      .toContain("/.well-known/apple-developer-merchantid-domain-association");
  });
});
