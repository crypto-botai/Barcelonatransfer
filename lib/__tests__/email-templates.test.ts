import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every transactional email is built on the one card in lib/email/premium.ts.
 * The driver's job sheet and six others were left on the old gradient layout
 * when the rest moved, so a driver's inbox showed a different company from
 * the customer's. These guards keep every sender on the same card.
 */
const ROOT    = process.cwd();
const RESEND  = readFileSync(join(ROOT, "lib", "resend.ts"), "utf-8");
const PREMIUM = readFileSync(join(ROOT, "lib", "email", "premium.ts"), "utf-8");

describe("email templates", () => {
  it("has no old layout left to fall back to", () => {
    expect(RESEND).not.toContain("function emailLayout(");
    expect(RESEND).not.toContain("emailLayout(");
    expect(RESEND).not.toContain("Luxury Transfers · Barcelona</p>");
  });

  it("sends every booking-lifecycle email as a premium card", () => {
    const pairs: Array<[string, string]> = [
      ["sendDriverBookingDetailsEmail", "driverJobCard("],
      ["sendFailedPaymentEmail",        "paymentFailedCard("],
      ["sendBookingCancelledEmail",     "bookingCancelledCard("],
      ["sendCancellationEmail",         "bookingCancelledCard("],
      ["sendAdminCancellationAlert",    "adminCancellationCard("],
      ["sendPickupChangedEmail",        "pickupChangedCard("],
      ["sendAdminPickupChangedAlert",   "adminPickupChangedCard("],
      ["sendBookingConfirmation",       "bookingReceivedCard("],
      ["sendDriverAssignedEmail",       "driverAssignedCard("],
      ["sendPickupReminder",            "rideConfirmedCard("],
    ];
    for (const [sender, card] of pairs) {
      const start = RESEND.indexOf(`export async function ${sender}(`);
      expect(start, `${sender} missing`).toBeGreaterThan(-1);
      const next = RESEND.indexOf("\nexport async function", start + 1);
      const body = RESEND.slice(start, next < 0 ? undefined : next);
      expect(body, `${sender} does not render ${card}`).toContain(card);
      expect(body, `${sender} does not wrap in emailDocument`).toContain("emailDocument(");
    }
  });

  it("gives the driver what they need to drive the job", () => {
    const start = PREMIUM.indexOf("export function driverJobCard(");
    const body  = PREMIUM.slice(start, PREMIUM.indexOf("export function", start + 1));
    for (const label of ['"Client"', '"Phone"', '"Pick-up"', '"Drop-off"', '"When"', '"Vehicle"', '"Guests"', '"Flight"', '"Bring"', '"Notes"']) {
      expect(body, `driver card lacks ${label} row`).toContain(`row(${label}`);
    }
    expect(body).toContain('amountBar("Your earnings"');
  });

  it("does not put HTML entities through the escaping eyebrow", () => {
    // eyebrow() escapes its text, so "&middot;" would print literally.
    expect(PREMIUM).not.toMatch(/eyebrow\("[^"]*&[a-z]+;/);
  });
});
