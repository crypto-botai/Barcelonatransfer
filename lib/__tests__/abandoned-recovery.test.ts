import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ABANDON_AFTER_MS } from "@/lib/abandoned";

/**
 * Bringing back the people who nearly booked. Guards the owner's rules: one
 * automatic email a quarter of an hour after they go quiet, sent from form
 * traffic rather than a once-a-day cron, unpaid website bookings kept out of
 * the bookings list, and the office able to write in its own words.
 */
const ROOT = process.cwd();
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("abandoned recovery", () => {
  const lib = rd("lib/abandoned.ts");

  it("waits fifteen minutes, not an hour", () => {
    expect(ABANDON_AFTER_MS).toBe(15 * 60_000);
  });

  it("runs on form traffic in the background, with the daily cron as backstop", () => {
    for (const f of ["app/api/quote/route.ts", "app/api/booking-session/route.ts"]) {
      expect(rd(f), f).toContain("after(() => sweepAbandonedIfDue()");
    }
    expect(rd("app/api/cron/daily/route.ts")).toContain("const r = await sweepAbandoned();");
    // The old cron body wrote SENT rows without sending; it is gone.
    expect(rd("app/api/cron/daily/route.ts")).not.toContain('subject: "Complete your Elite BCN booking"');
  });

  it("emails a session once, and an unpaid booking once", () => {
    expect(lib).toContain("abandonedBooking: null");
    expect(lib).toContain('where: { bookingId: b.id, type: "ABANDONED" }');
    // Only website bookings; ones the office made by hand are confirmed.
    expect(lib).toContain("paymentMethod: null,");
  });

  it("the recovery email is a premium card with the price, a resume button and WhatsApp", () => {
    const prem = rd("lib/email/premium.ts");
    expect(prem).toContain("export function abandonedRecoveryCard(");
    expect(prem).toContain('button(o.resumeUrl, "Finish My Booking")');
    expect(prem).toContain('"Talk to us on WhatsApp"');
    expect(prem).toContain('amountBar("Your fixed price"');
    const resend = rd("lib/resend.ts");
    expect(resend).not.toContain("function abandonedBookingHtml(");
    expect(resend).toContain("abandonedRecoveryCard({");
  });

  it("the office can write in its own words, on the same card", () => {
    expect(rd("lib/email/premium.ts")).toContain("export function personalNoteCard(");
    const api = rd("app/api/admin/abandoned/route.ts");
    expect(api).toContain('kind: z.enum(["recovery", "note"])');
    expect(api).toContain("sendPersonalNoteEmail({");
    expect(rd("app/admin/abandoned/page.tsx")).toContain("Write to them");
  });

  it("keeps unpaid website bookings out of the bookings list and shows them under Abandoned", () => {
    expect(rd("app/api/admin/bookings/route.ts")).toContain('NOT: { status: "PENDING", paymentStatus: "PENDING", paymentMethod: null }');
    expect(rd("app/api/admin/abandoned/route.ts")).toContain('status: "PENDING", paymentStatus: "PENDING", paymentMethod: null');
  });

  it("reports every recovery email, automatic or by hand", () => {
    expect(rd("app/api/admin/abandoned/route.ts")).toContain('type: { in: ["ABANDONED", "ABANDONED_MANUAL"] }');
    expect(rd("app/admin/abandoned/page.tsx")).toContain("Emails sent");
  });
});

describe("no discount, and only with consent", () => {
  it("the recovery email carries no coupon", () => {
    expect(rd("lib/email/premium.ts")).not.toMatch(/couponCode/);
    expect(rd("lib/abandoned.ts")).not.toContain("createAbandonedCoupon");
    expect(rd("app/api/cron/abandoned-check/route.ts")).not.toContain("createAbandonedCoupon");
    expect(rd("lib/resend.ts")).not.toMatch(/sendAbandonedBookingEmail\(\{[\s\S]{0,80}couponCode/);
  });
  it("a lead who did not tick the contact box is filed but not emailed automatically", () => {
    expect(rd("lib/abandoned.ts")).toContain("if (fd.contactConsent !== true) { out.skipped++; continue; }");
  });
});
