import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAYMENT_METHODS, paymentLine } from "@/lib/payment-method";

/**
 * Fleet partner companies and office-made bookings. These guard the owner's
 * decisions: a company's driver is never on the office roster, the customer
 * never sees the company name, a payout counts only once the ride is done,
 * and every email involved is a premium card.
 */
const ROOT = process.cwd();
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("payment methods", () => {
  it("match the database enum", () => {
    const schema = rd("prisma/schema.prisma");
    const m = schema.match(/enum BookingPaymentMethod \{([^}]+)\}/)!;
    const dbValues = m[1].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"));
    expect(dbValues.sort()).toEqual([...PAYMENT_METHODS].sort());
  });

  it("tell the customer something for every method, paid or not", () => {
    for (const m of PAYMENT_METHODS) {
      expect(paymentLine(m, false, 80).length).toBeGreaterThan(20);
      expect(paymentLine(m, true, 80)).toMatch(/received/);
    }
    expect(paymentLine("CASH", false, 80)).toMatch(/cash/i);
    expect(paymentLine("CARD_LINK", false, 80)).toMatch(/card/i);
  });

  it("admin can create a booking with a method and mark it paid", () => {
    const create = rd("app/api/admin/bookings/route.ts");
    expect(create).toContain("paymentMethod:");
    expect(create).toContain("createSumUpCheckout(");
    expect(create).toContain("paidMarkedBy:");
    const mark = rd("app/api/admin/bookings/[id]/payment/route.ts");
    expect(mark).toContain("sendPaymentConfirmationEmail(");
    expect(mark).toContain("paidMarkedBy:");
    const page = rd("app/admin/bookings/new/page.tsx");
    expect(page).toContain('fetch("/api/quote"');
    expect(page).toContain("PAYMENT_METHODS.map");
  });
});

describe("fleet partners", () => {
  const partner = rd("lib/partner.ts");

  it("keeps the office and the company apart in the router", () => {
    const mw = rd("middleware.ts");
    expect(mw).toContain('pathname.startsWith("/partner")');
    expect(mw).toMatch(/role !== "PARTNER"/);
    // A partner hitting /admin is sent to their own panel, never let through.
    expect(mw).toMatch(/if \(role === "PARTNER"\) return NextResponse\.redirect\(new URL\("\/partner"/);
  });

  it("keeps company drivers off the office rosters", () => {
    expect(rd("app/api/admin/drivers/route.ts")).toMatch(/where: \{ partnerId: null \}/);
    expect(rd("app/admin/dispatch/page.tsx")).toMatch(/partnerId: null, status/);
  });

  it("a company can only dispatch its own jobs to its own drivers", () => {
    expect(partner).toContain("booking.partnerId !== partnerId");
    expect(partner).toContain("driver.partnerId !== partnerId");
  });

  it("dispatch tells the customer, the driver and the office", () => {
    const fn = partner.slice(partner.indexOf("export async function dispatchPartnerJob("), partner.indexOf("export async function completePartnerJob("));
    expect(fn).toContain("sendDriverAssignedEmail(");
    expect(fn).toContain("sendDriverBookingDetailsEmail(");
    expect(fn).toContain("sendAdminPartnerDispatchAlert(");
    // The driver is shown the company's figure, not the office payout.
    expect(fn).toMatch(/driverAmount,\s*\}\)\.catch/);
    expect(fn).toContain('status: "DRIVER_ASSIGNED"');
  });

  it("the customer never sees the company", () => {
    const card = rd("lib/email/premium.ts");
    const assigned = card.slice(card.indexOf("export function driverAssignedCard("), card.indexOf("export function paymentReceiptCard("));
    expect(assigned).not.toMatch(/company|partner/i);
  });

  it("a payout counts only once the ride is completed", () => {
    const fn = partner.slice(partner.indexOf("export async function partnerBalance("), partner.indexOf("export async function requestPartnerWithdrawal("));
    expect(fn).toContain('status: "COMPLETED"');
    expect(fn).toContain("_sum: { partnerPayout: true }");
  });

  it("a withdrawal cannot exceed the available balance", () => {
    expect(partner).toMatch(/input\.amount > bal\.available/);
  });

  it("company drivers do not withdraw from Elite BCN", () => {
    const dash = rd("components/driver/DriverDashboard.tsx");
    expect(dash).toContain("driver.partnerName ? []");
    expect(dash).toContain("{!driver.partnerName && (");
  });

  it("every partner email is a premium card", () => {
    const resend = rd("lib/resend.ts");
    for (const [sender, card] of [
      ["sendPartnerJobEmail", "partnerJobCard("],
      ["sendAdminPartnerDispatchAlert", "adminPartnerDispatchCard("],
      ["sendTemporaryPassword", "credentialsCard("],
    ]) {
      const start = resend.indexOf(`export async function ${sender}(`);
      expect(start, `${sender} missing`).toBeGreaterThan(-1);
      const next = resend.indexOf("\nexport async function", start + 1);
      const body = resend.slice(start, next < 0 ? undefined : next);
      expect(body, `${sender} does not render ${card}`).toContain(card);
      expect(body).toContain("emailDocument(");
    }
    // The old plain-white sign-in email is gone.
    expect(resend).not.toContain("background:#efece5");
  });

  it("the partner panel has its five destinations and no link into the office", () => {
    const shell = rd("components/partner/PartnerShell.tsx");
    for (const href of ["/partner", "/partner/jobs", "/partner/drivers", "/partner/payments", "/partner/account"]) expect(shell).toContain(`"${href}"`);
    expect(shell).not.toContain('"/admin');
    for (const p of ["app/partner/page.tsx", "app/partner/jobs/page.tsx", "app/partner/drivers/page.tsx", "app/partner/payments/page.tsx", "app/partner/account/page.tsx"]) {
      expect(rd(p)).not.toContain("/admin");
    }
  });

  it("uses no em-dash in the partner panel copy", () => {
    for (const p of ["components/partner/PartnerShell.tsx", "components/partner/ui.tsx", "app/partner/page.tsx", "app/partner/jobs/page.tsx", "app/partner/drivers/page.tsx", "app/partner/payments/page.tsx", "app/partner/account/page.tsx"]) {
      expect(rd(p), p).not.toContain("—");
    }
  });
});
