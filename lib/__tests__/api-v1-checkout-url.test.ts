import { describe, it, expect } from "vitest";
import { paymentPageUrl } from "@/lib/api/v1/checkout-url";

const SITE = "https://www.elitebcn.info";

describe("paymentPageUrl", () => {
  it("turns the website's payment path into a full address the app can open", () => {
    expect(paymentPageUrl("/booking/pay/abc123?booking_id=b1", SITE)).toBe("https://www.elitebcn.info/booking/pay/abc123?booking_id=b1");
    expect(paymentPageUrl("/booking/pay/abc123", `${SITE}/`)).toBe("https://www.elitebcn.info/booking/pay/abc123");
  });

  it("keeps a full https payment address as it is", () => {
    expect(paymentPageUrl("https://www.elitebcn.info/booking/pay/abc?booking_id=b1", SITE)).toBe("https://www.elitebcn.info/booking/pay/abc?booking_id=b1");
    expect(paymentPageUrl("https://checkout.sumup.com/pay/xyz", SITE)).toBe("https://checkout.sumup.com/pay/xyz");
  });

  it("returns null when there is nothing to pay online", () => {
    // The handler's fallback when SumUp is not configured or the checkout failed.
    expect(paymentPageUrl("/booking/success?booking_id=b1", SITE)).toBeNull();
    expect(paymentPageUrl("https://www.elitebcn.info/booking/success?booking_id=b1", SITE)).toBeNull();
    expect(paymentPageUrl("", SITE)).toBeNull();
    expect(paymentPageUrl(undefined, SITE)).toBeNull();
    expect(paymentPageUrl("http://insecure.example/pay", SITE)).toBeNull();
    expect(paymentPageUrl("javascript:alert(1)", SITE)).toBeNull();
  });
});
