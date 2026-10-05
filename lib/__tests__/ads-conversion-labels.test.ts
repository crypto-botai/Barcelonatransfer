import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { track, resetTrackingForTests } from "@/lib/tracking/events";

/**
 * Google Ads counts a sale only when the conversion call carries the label of
 * the "Booking Paid" action. Without it the paid booking reaches GA4 but never
 * Ads, and the campaigns optimise on page views instead.
 */

const gtag = vi.fn();

beforeEach(() => {
  gtag.mockReset();
  resetTrackingForTests();
  vi.stubGlobal("window", { gtag, sessionStorage: { getItem: () => null, setItem: () => undefined } });
});
afterEach(() => vi.unstubAllGlobals());

const conversions = () => gtag.mock.calls.filter((c) => c[1] === "conversion").map((c) => c[2]);

describe("Google Ads conversion labels", () => {
  it("counts a paid booking against the Booking Paid action, with its value and booking id", () => {
    track("order_created", { bookingId: "b1", value: 95, currency: "EUR" });
    expect(conversions()).toEqual([
      { send_to: "AW-18391666445/iwx8CNL0_IodEI2e6sFE", value: 95, currency: "EUR", transaction_id: "b1" },
    ]);
  });

  it("counts a started booking against the Booking Started action", () => {
    track("booking_started", { bookingId: "b2" });
    expect(conversions()[0].send_to).toBe("AW-18391666445/XgujCNj0_IodEI2e6sFE");
  });

  it("sends nothing to Ads for checkout, which has no Ads action, but still tells GA4", () => {
    track("checkout_started", { bookingId: "b3" });
    expect(conversions()).toEqual([]);
    expect(gtag.mock.calls[0].slice(0, 2)).toEqual(["event", "checkout_started"]);
  });

  it("counts a booking once, however many times the page reports it", () => {
    track("order_created", { bookingId: "b4", value: 50 });
    track("order_created", { bookingId: "b4", value: 50 });
    expect(conversions()).toHaveLength(1);
  });
});
