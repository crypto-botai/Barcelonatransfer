import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXTRAS_CATALOG } from "@/types";
import { extrasCostFor } from "@/lib/loyalty";
import { wantsSmsAlerts, formatExtraNames, forChauffeur, parseBookingMeta, SMS_ALERTS_ID } from "@/lib/booking-meta";
import { smsTextFor, NO_REPLY } from "@/lib/notifications/sms-copy";
import { smsSegments } from "@/lib/sms";
import { driverJobCard } from "@/lib/email/premium";

/**
 * The paid text-alerts add-on.
 *
 * A customer who pays 0.50 at checkout is texted twice: when the booking is
 * confirmed and when a driver is assigned. Nobody else is texted
 * automatically, because every text costs money and a text for every status
 * change is exactly what this option is not.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const WITH = '[META]{"extras":[{"id":"sms_alerts","label":"Text Message Alerts","price":0.5,"quantity":1},'
  + '{"id":"meet_greet","label":"Meet & Greet","price":5,"quantity":1}]}[/META] hello';
const WITHOUT = '[META]{"extras":[{"id":"meet_greet","label":"Meet & Greet","price":5,"quantity":1}]}[/META]';

describe("the add-on at checkout", () => {
  it("is in the catalogue at fifty cents, once per booking", () => {
    const e = EXTRAS_CATALOG.find((x) => x.id === SMS_ALERTS_ID)!;
    expect(e).toBeTruthy();
    expect(e.price).toBe(0.5);
    expect(e.maxQty).toBe(1);
  });

  it("is priced by the server from the catalogue, never from the request", () => {
    expect(extrasCostFor([{ id: "sms_alerts", quantity: 1 }])).toBe(0.5);
    // A crafted quantity or price cannot change it.
    expect(extrasCostFor([{ id: "sms_alerts", quantity: 9, price: -100 }])).toBe(0.5);
  });

  it("refuses a number that cannot be texted rather than charging for it", () => {
    const route = rd("app/api/bookings/route.ts");
    expect(route).toContain("e.id === SMS_ALERTS_ID");
    expect(route).toContain("!toE164(body.guestPhone)");
    expect(route).toMatch(/Text alerts need a mobile number with its country code/);
  });
});

describe("who is texted", () => {
  it("only a customer who bought the add-on", () => {
    expect(wantsSmsAlerts(WITH)).toBe(true);
    expect(wantsSmsAlerts(WITHOUT)).toBe(false);
    expect(wantsSmsAlerts(null)).toBe(false);
    expect(wantsSmsAlerts("just a note")).toBe(false);
  });

  it("the confirmation and the driver assignment ask for a text only for them", () => {
    for (const [file, expr] of [
      ["lib/payment-completion.ts", "wantsSmsAlerts(updated.specialRequests)"],
      ["app/api/bookings/[id]/route.ts", "wantsSmsAlerts(booking.specialRequests)"],
      ["lib/partner.ts", "wantsSmsAlerts(booking.specialRequests)"],
    ] as const) {
      const src = rd(file);
      expect(src, file).toContain(expr + " ?");
      expect(src, file).not.toMatch(/channels:\s*\[[^\]]*"sms"[^\]]*\],/);
    }
  });

  it("nothing else texts a customer on its own", () => {
    for (const file of ["app/api/cron/pickup-reminder/route.ts", "lib/flights/sweep.ts"]) {
      expect(rd(file), file).not.toMatch(/"sms"/);
    }
  });
});

describe("what the text says", () => {
  const VARS = { code: "ABC123", when: "3 Oct 10:30", route: "BCN T1 to Sitges", driver: "Marc", link: "https://www.elitebcn.info/track/ABC123" };

  it("tells the customer not to reply and where to reach us, in every language", () => {
    for (const locale of ["en", "es", "fr", "de"] as const) {
      for (const event of ["BOOKING_CONFIRMED", "DRIVER_ASSIGNED"] as const) {
        const t = smsTextFor(event, locale, VARS)!;
        expect(t, `${event}/${locale}`).toContain("+34635383712");
        expect(t.endsWith(NO_REPLY[locale].replace(/[^\x00-\x7F]/g, "")) || t.includes("+34635383712")).toBe(true);
      }
    }
    expect(smsTextFor("BOOKING_CONFIRMED", "en", VARS)).toMatch(/Do not reply to this message\. To talk to us, call, text or WhatsApp \+34635383712$/);
  });

  it("keeps the notice when a long address has to be shortened", () => {
    const t = smsTextFor("BOOKING_CONFIRMED", "en", { ...VARS, route: "x ".repeat(100) })!;
    expect(t).toContain("+34635383712");
    expect(t).toContain(VARS.link);
  });

  it("stays at two or three segments", () => {
    for (const event of ["BOOKING_CONFIRMED", "DRIVER_ASSIGNED"] as const) {
      const t = smsTextFor(event, "en", VARS)!;
      expect(smsSegments(t), t).toBeLessThanOrEqual(3);
    }
  });
});

describe("the add-on is the customer's business, not the chauffeur's", () => {
  it("is not listed as something to bring", () => {
    expect(formatExtraNames(parseBookingMeta(WITH).extras)).toBe("Meet & Greet");
    expect(forChauffeur(parseBookingMeta(WITH).extras).map((e) => e.id)).toEqual(["meet_greet"]);
  });

  it("does not reach the driver's email or the fleet panel", () => {
    const html = driverJobCard({
      driverName: "Marc", confirmationCode: "X", guestName: "A", guestPhone: "+34600",
      pickupAddress: "P", dropoffAddress: "D", pickupDatetime: "2027-01-01 10:00",
      vehicle: "V-Class", passengers: 2, luggage: 2,
      extras: formatExtraNames(parseBookingMeta(WITH).extras),
    });
    expect(html).not.toMatch(/Text Message Alerts/);
    expect(rd("app/api/partner/jobs/route.ts")).toContain("forChauffeur(meta.extras)");
  });
});
