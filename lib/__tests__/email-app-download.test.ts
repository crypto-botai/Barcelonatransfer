import { describe, it, expect, afterEach } from "vitest";
import { bookingReceivedCard, rideConfirmedCard } from "@/lib/email/premium";
import { CUSTOMER_APP_LINKS, customerAppPromoEnabled } from "@/lib/mobile-apps";

/**
 * The booking confirmation can invite the customer to download the app. It is
 * off until the store listings are public: a store link that is not live yet
 * shows "not found", on the one email a customer reads most carefully.
 */

const booking = {
  firstName: "Ana", confirmationCode: "EB10482",
  pickupAddress: "Barcelona Airport Terminal 1", dropoffAddress: "Hotel Arts Barcelona",
  date: "Sat 14 Oct 2026", time: "16:00", vehicle: "Business", passengers: 2, totalAmount: 70,
};

const original = process.env.CUSTOMER_APP_PROMO;
afterEach(() => {
  if (original === undefined) delete process.env.CUSTOMER_APP_PROMO;
  else process.env.CUSTOMER_APP_PROMO = original;
});

describe("app download link in the booking confirmation email", () => {
  it("points at the two store listings", () => {
    expect(CUSTOMER_APP_LINKS.android).toBe("https://play.google.com/store/apps/details?id=info.elitebcn.customer");
    expect(CUSTOMER_APP_LINKS.ios).toBe("https://apps.apple.com/app/id6822434720");
  });

  it("is off unless CUSTOMER_APP_PROMO is exactly 1", () => {
    delete process.env.CUSTOMER_APP_PROMO;
    expect(customerAppPromoEnabled()).toBe(false);
    process.env.CUSTOMER_APP_PROMO = "true";
    expect(customerAppPromoEnabled()).toBe(false);
    process.env.CUSTOMER_APP_PROMO = "1";
    expect(customerAppPromoEnabled()).toBe(true);
  });

  it("says nothing about the app while it is off", () => {
    delete process.env.CUSTOMER_APP_PROMO;
    const html = bookingReceivedCard(booking);
    expect(html).not.toContain("play.google.com");
    expect(html).not.toContain("apps.apple.com");
    expect(html).not.toContain("Get it on Google Play");
  });

  it("offers both stores when it is on", () => {
    process.env.CUSTOMER_APP_PROMO = "1";
    const html = bookingReceivedCard(booking);
    expect(html).toContain(CUSTOMER_APP_LINKS.android);
    expect(html).toContain(CUSTOMER_APP_LINKS.ios);
    expect(html).toContain("Get it on Google Play");
    expect(html).toContain("Download on the App Store");
  });

  it("appears once, in the booking confirmation only", () => {
    process.env.CUSTOMER_APP_PROMO = "1";
    const html = bookingReceivedCard(booking);
    expect(html.split(CUSTOMER_APP_LINKS.android).length - 1).toBe(1);
    const confirmed = rideConfirmedCard({
      firstName: "Ana", confirmationCode: "EB10482", driverName: "Test Driver",
      pickupAddress: booking.pickupAddress, dropoffAddress: booking.dropoffAddress,
      date: booking.date, time: booking.time, vehicle: booking.vehicle,
    } as never);
    expect(confirmed).not.toContain(CUSTOMER_APP_LINKS.android);
  });
});
