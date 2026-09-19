import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVENT_DEFS } from "@/lib/notifications/events";
import { calendarLinks, icsFile, returnTripUrl } from "@/lib/calendar";

/**
 * Live ride updates on the customer's phone, the driver's phone, the rating
 * at drop-off, and the small extras in the confirmation.
 */
const ROOT = process.cwd();
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("push on the phone", () => {
  it("the moments the owner listed all push", () => {
    for (const e of ["RIDE_TODAY", "DRIVER_ARRIVED", "DRIVER_WAITING", "RIDE_COMPLETED", "RATE_RIDE", "DRIVER_NEW_JOB", "TRIP_MESSAGE"] as const) {
      expect(EVENT_DEFS[e].channels, e).toContain("push");
    }
    // Never by email: these are phone moments.
    for (const e of ["DRIVER_WAITING", "RATE_RIDE", "RIDE_TODAY"] as const) expect(EVENT_DEFS[e].channels).not.toContain("email");
  });
  it("a guest booking can subscribe with its code and is reached by booking", () => {
    expect(rd("app/api/push/subscribe/route.ts")).toContain("guestPushKey(parsedEarly.data.bookingId)");
    expect(rd("lib/notifications/push.ts")).toContain("export async function sendPushToBooking(");
    expect(rd("lib/notifications/service.ts")).toContain("sendPushToBooking(input.bookingId, payload)");
  });
  it("the toggle is on the tracking pages, the success page and the driver portal, and explains iPhone", () => {
    for (const p of ["app/dashboard/tracking/[id]/page.tsx", "components/tracking/PublicTrackClient.tsx", "app/booking/success/page.tsx", "components/driver/DriverDashboard.tsx"]) {
      expect(rd(p), p).toContain("<RideAlerts");
    }
    expect(rd("components/notifications/RideAlerts.tsx")).toContain("Add to Home Screen");
  });
  it("the driver's phone hears about a new job and a customer message", () => {
    expect(rd("app/api/bookings/[id]/route.ts")).toContain('event: "DRIVER_NEW_JOB", userId: booking.driver.userId');
    expect(rd("lib/partner.ts")).toContain('event: "DRIVER_NEW_JOB", userId: driver.userId');
    expect(rd("lib/trip-chat.ts")).toContain('userId: booking.driver.userId, url: "/driver"');
  });
});

describe("rating at drop-off", () => {
  it("the review email and push go the moment the ride is completed, once", () => {
    const ride = rd("app/api/driver/ride/route.ts");
    expect(ride).toContain('where: { bookingId: booking.id, type: "REVIEW" }');
    expect(ride).toContain('event: "RATE_RIDE"');
    expect(rd("lib/partner.ts")).toContain('event: "RATE_RIDE"');
  });
  it("the review page rates the chauffeur and the company, and asks for Google", () => {
    const page = rd("app/review/page.tsx");
    expect(page).toContain("Elite BCN overall");
    expect(page).toContain("companyRating");
    expect(page).toContain("Write a Google review");
    expect(rd("app/api/bookings/review/route.ts")).toContain('action: "COMPANY_RATING"');
  });
});

describe("confirmation extras", () => {
  const b = { id: "b1", confirmationCode: "ABCDEFGH", pickupAddress: "Terminal 1, El Prat", dropoffAddress: "Hotel Arts, Barcelona", pickupDatetime: new Date("2026-09-25T08:00:00Z"), durationMin: 30 };
  it("calendar links point at Google and at the .ics proved by the code", () => {
    const c = calendarLinks(b);
    expect(c.google).toContain("calendar.google.com");
    expect(c.google).toContain("20260925T080000Z");
    expect(c.ics).toContain("/api/bookings/b1/calendar?code=ABCDEFGH");
    expect(icsFile(b)).toContain("BEGIN:VEVENT");
    expect(icsFile(b)).toContain("DTSTART:20260925T080000Z");
  });
  it("the return link reverses the journey", () => {
    const u = returnTripUrl({ pickupAddress: "A", dropoffAddress: "B", pickupLat: 1, pickupLng: 2, dropoffLat: 3, dropoffLng: 4 });
    expect(u).toContain("pickupAddress=B");
    expect(u).toContain("dropoffAddress=A");
    expect(u).toContain("pickupLat=3");
    expect(returnTripUrl({ pickupAddress: "A", dropoffAddress: null })).toBeNull();
  });
  it("the card offers both, and the site's booking flows pass them", () => {
    const prem = rd("lib/email/premium.ts");
    expect(prem).toContain("Add to your calendar");
    expect(prem).toContain("Book my return journey");
    expect(rd("app/api/bookings/route.ts")).toContain("calendar: calendarLinks(");
    expect(rd("app/api/admin/bookings/route.ts")).toContain("returnUrl: returnTripUrl(");
    expect(rd("app/booking/success/page.tsx")).toContain("Book my return journey");
  });
  it("the abandoned page's WhatsApp button carries the route and price", () => {
    expect(rd("app/admin/abandoned/page.tsx")).toContain("this is Elite BCN Transfers. I saw you were booking");
  });
});

describe("Google review link", () => {
  it("is the direct g.page review link, used by the review page and the review email", async () => {
    const { GOOGLE_PROFILE } = await import("@/data/reviews");
    expect(GOOGLE_PROFILE.reviewUrl).toMatch(/^https:\/\/g\.page\/r\/[A-Za-z0-9_-]+\/review$/);
    expect(rd("app/review/page.tsx")).toContain("GOOGLE_PROFILE.reviewUrl ||");
    expect(rd("lib/resend.ts")).toContain("googleUrl: GOOGLE_PROFILE.reviewUrl");
    expect(rd("lib/email/premium.ts")).toContain('"Or review us on Google"');
  });
});

describe("the office sending a notification by hand", () => {
  it("reaches a booking's phones or a driver's, by push and in-app only", () => {
    const api = rd("app/api/admin/notify/route.ts");
    expect(api).toContain('event: "OFFICE_MESSAGE"');
    expect(api).toContain('channels: ["inapp", "push"]');
    expect(EVENT_DEFS.OFFICE_MESSAGE.channels).not.toContain("email");
    expect(rd("app/admin/bookings/page.tsx")).toContain('<SendNotificationButton bookingId={booking.id}');
    expect(rd("app/admin/drivers/page.tsx")).toContain("<SendNotificationButton driverId={d.id}");
  });
});
