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
    expect(mw).toMatch(/if \(role === "PARTNER"\) return noindex\(NextResponse\.redirect\(new URL\("\/partner"/);
    // Anyone else hitting /partner is told why, not dropped on another dashboard.
    expect(mw).toMatch(/if \(role !== "PARTNER"\) return noindex\(NextResponse\.redirect\(new URL\("\/fleet-login"/);
  });

  /**
   * The rules above have to be reachable.
   *
   * They were not. A block that set the noindex header returned straight
   * after it, for /auth, /admin, /driver, /partner and /dashboard - which is
   * every path these rules are about. The one that matters most is the
   * signed-in user on /auth/login: the rule to send them to their own panel
   * never ran, so anything that bounced them to the login form left them
   * there. They signed in, the form accepted it, and nothing moved.
   */
  it("does not return before the role rules can run", () => {
    const mw = rd("middleware.ts");
    const roleRules = mw.indexOf("const role = token.role");
    expect(roleRules).toBeGreaterThan(-1);

    // Nothing between the noindex helper and the role rules may return
    // unconditionally for a staff path.
    const before = mw.slice(mw.indexOf("const isStaffRoute"), roleRules);
    expect(before).not.toMatch(/\n\s*return noindex\(NextResponse\.next\(\)\);\s*\n\s*\}\s*\n\s*\n?\s*\/\/ ──/);
    // The signed-in-on-the-login-page rule exists and is after the helper.
    expect(mw.indexOf('pathname.startsWith("/auth/login")')).toBeGreaterThan(roleRules);
  });

  /**
   * The office must be able to mend a company login that lost its company.
   *
   * FleetPartner.userId is required and cascades from the user, so the row
   * cannot be orphaned the other way round: the only way to reach this state
   * is for the company record to be deleted while its login survives. That
   * login then opens nothing, and the one screen that could re-attach a
   * company refused it, because the account was already a PARTNER rather than
   * a customer. Both halves of the trap are closed here.
   */
  it("lets the office re-attach a company to a login that lost one", () => {
    expect(partner).toContain("const lostItsCompany = existing.role === \"PARTNER\"");
    expect(partner).toMatch(/if \(\(existing\.role !== "CUSTOMER" && !lostItsCompany\) \|\| existing\.driver\)/);
    // Still refuses a login that already has a company, and a driver.
    expect(partner).toContain('if (existing.fleetPartner) throw new Error("That account is already a fleet company")');
    expect(partner).toMatch(/\|\| existing\.driver\)/);
  });

  /** A signed-in company on the login form is moved on, not left sitting there. */
  it("sends a signed-in company away from the login form", () => {
    const mw = rd("middleware.ts");
    const block = mw.slice(mw.indexOf('pathname.startsWith("/auth/login")'));
    expect(block.slice(0, 400)).toMatch(/role === "PARTNER"[\s\S]{0,80}\/partner/);
  });

  /**
   * The loop itself: a PARTNER login whose company record is missing.
   *
   * The panel bounced it to /auth/login, which is a page, not an explanation.
   * It now goes to /fleet-login, and /fleet-login checks for the same record
   * before sending a PARTNER back, so neither can bounce the other.
   */
  it("does not bounce a company with no company record back to the login form", () => {
    const layout = rd("app/partner/(panel)/layout.tsx");
    expect(layout).toContain('if (!partner) redirect("/fleet-login")');
    expect(layout).not.toContain('if (!partner) redirect("/auth/login")');

    const fleetLogin = rd("app/fleet-login/page.tsx");
    // It must look the record up rather than trusting the role alone.
    expect(fleetLogin).toContain("fleetPartner.findUnique");
    expect(fleetLogin).toContain('if (company) redirect("/partner")');
    expect(fleetLogin).not.toMatch(/if \(u\?\.role === "PARTNER"\) redirect\("\/partner"\)/);
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
    expect(fn).toContain('status: "COMPLETED" as const');
    expect(fn).toMatch(/_sum: \{ partnerPayout: true/);
  });

  /**
   * What the company keeps, and what its drivers earned.
   *
   * partnerPayout is what Elite BCN pays the company for a job; driverAmount
   * is what the company told its own driver they would get for it. Both were
   * already stored per booking and neither was ever added up, so a company
   * could see its payout but not its own margin against it.
   */
  it("reports the company's margin and what its drivers earned", () => {
    const fn = partner.slice(partner.indexOf("export async function partnerBalance("), partner.indexOf("export async function requestPartnerWithdrawal("));
    expect(fn).toMatch(/_sum: \{ partnerPayout: true, driverAmount: true \}/);
    expect(fn).toContain("owedToDrivers:");
    expect(fn).toContain("commission:");
    // The margin is the difference, never a rate pulled from somewhere else.
    expect(fn).toMatch(/commission:\s*round2\(totalEarned - owedToDrivers\)/);
  });

  /** The company's week is the one it works, so Monday is Barcelona's Monday. */
  it("counts the week from Monday in Barcelona, not from the server's clock", () => {
    expect(partner).toContain("function weekStartMadrid(");
    expect(partner).toContain("timeZone: BOOKING_TIMEZONE");
    expect(partner).toMatch(/week: \{[\s\S]{0,260}commission: round2\(weekEarned - weekToDrivers\)/);
    // The window is anchored on when the ride actually ended.
    expect(partner).toMatch(/rideEndedAt: \{ gte: weekFrom \}/);
  });

  /**
   * Nothing records a company paying its driver, so the figure is a total
   * earned rather than an outstanding balance, and the panel has to say so.
   */
  it("does not present the driver total as an outstanding balance", () => {
    const page = rd("app/partner/(panel)/payments/page.tsx");
    expect(page).toMatch(/total earned, not an outstanding balance/i);
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
    for (const p of ["app/partner/(panel)/page.tsx", "app/partner/(panel)/jobs/page.tsx", "app/partner/(panel)/drivers/page.tsx", "app/partner/(panel)/payments/page.tsx", "app/partner/(panel)/account/page.tsx"]) {
      expect(rd(p)).not.toContain("/admin");
    }
  });

  it("uses no em-dash in the partner panel copy", () => {
    for (const p of ["components/partner/PartnerShell.tsx", "components/partner/ui.tsx", "app/partner/(panel)/page.tsx", "app/partner/(panel)/jobs/page.tsx", "app/partner/(panel)/drivers/page.tsx", "app/partner/(panel)/payments/page.tsx", "app/partner/(panel)/account/page.tsx"]) {
      expect(rd(p), p).not.toContain("—");
    }
  });
});

describe("deleting your own account", () => {
  const api = rd("app/api/account/route.ts");
  it("is offered on the customer, driver and company portals", () => {
    expect(rd("app/dashboard/profile/page.tsx")).toContain('<DeleteAccountButton kind="customer" />');
    expect(rd("components/driver/DriverDashboard.tsx")).toContain('<DeleteAccountButton kind="driver" />');
    expect(rd("app/partner/(panel)/account/page.tsx")).toContain('<DeleteAccountButton kind="company" />');
  });
  it("refuses admins and keeps bookings as records", () => {
    expect(api).toMatch(/u\.role === "ADMIN"\) return NextResponse\.json/);
    expect(api).toContain("data: { userId: null }");
    expect(api).not.toMatch(/booking\.deleteMany/);
  });
  it("takes a company's drivers with it and unassigns their jobs", () => {
    expect(api).toContain("where: { partnerId: user.fleetPartner.id }, select: { id: true, userId: true }");
    expect(api).toContain("data: { driverId: null }");
    expect(api).toContain("id: { in: driverUserIds }");
  });
  it("needs the word DELETE typed", () => {
    expect(rd("components/account/DeleteAccountButton.tsx")).toContain('typed !== "DELETE"');
  });
});

describe("choosing the kind of account", () => {
  it("offers customer, driver and fleet company on sign-up and login", () => {
    const chooser = rd("components/auth/AccountTypeChooser.tsx");
    for (const h of ['"/auth/register"', '"/driver/register"', '"/partner/register"']) expect(chooser).toContain(h);
    expect(rd("app/auth/register/page.tsx")).toContain('<AccountTypeChooser current="customer" />');
    expect(rd("app/driver/register/page.tsx")).toContain('current="driver"');
    expect(rd("app/partner/register/page.tsx")).toContain('current="partner"');
    const login = rd("app/auth/login/page.tsx");
    for (const h of ['href="/auth/register"', 'href="/driver/register"', 'href="/partner/register"']) expect(login).toContain(h);
  });
  it("a self-registered company starts inactive and the office is told", () => {
    const api = rd("app/api/auth/partner-register/route.ts");
    expect(api).toContain("active: false");
    expect(api).toContain("sendAdminAlertEmail(");
    expect(api).toContain('role: "PARTNER"');
  });
  it("the company sign-up is reachable without a session and outside the panel layout", () => {
    expect(rd("middleware.ts")).toContain('!pathname.startsWith("/partner/register")');
    expect(require("node:fs").existsSync(join(ROOT, "app/partner/(panel)/layout.tsx"))).toBe(true);
    expect(require("node:fs").existsSync(join(ROOT, "app/partner/register/page.tsx"))).toBe(true);
  });
  it("an inactive company can look but not act", () => {
    const lib = rd("lib/partner.ts");
    expect(lib).toContain("if (!partner.active && !opts.allowInactive) return null;");
    expect(rd("app/api/partner/jobs/[id]/dispatch/route.ts")).toContain("await requirePartner();");
    expect(rd("app/api/partner/jobs/route.ts")).toContain("requirePartner({ allowInactive: true })");
  });
});

describe("sign-up pages are public", () => {
  it("driver and company registration are not sent to the login page", () => {
    const mw = rd("middleware.ts");
    expect(mw).toContain('pathname === "/driver/register" || pathname === "/partner/register"');
    // The login gate skips them, and only applies to the routes that need one.
    expect(mw).toMatch(/if \(needsLogin && !publicSignUp && !token\)/);
    expect(mw).toMatch(/const needsLogin = \[[^\]]*"\/admin"/);
  });
});
