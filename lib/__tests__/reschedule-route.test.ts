import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The rules the reschedule endpoint has to keep.
 *
 * Moving a booking touches money and tells a customer their car is coming at
 * a different time, so the things that must not slip are: only the office can
 * do it, a finished booking cannot be moved, and nothing is written until the
 * office has seen what the move costs and said yes.
 */

const ROOT = join(__dirname, "..", "..");
const route = readFileSync(
  join(ROOT, "app", "api", "admin", "bookings", "[id]", "reschedule", "route.ts"),
  "utf-8",
);

describe("who may move a booking", () => {
  it("refuses anyone who is not an admin", () => {
    expect(route).toContain("if (!await requireAdmin())");
    expect(route).toContain("{ status: 401 }");
    expect(route).toContain('u.role !== "ADMIN"');
  });

  /**
   * Customers were deliberately left out: they must call the office. The
   * file living under app/api/admin is what makes that true — reading it
   * from there above is the assertion; this guards the check inside it from
   * being relaxed to "any signed-in user owns this booking".
   */
  it("does not fall back to an ownership check", () => {
    expect(route).not.toMatch(/booking\.userId === user\.id/);
    expect(route).not.toMatch(/guestEmail === user\.email/);
  });
});

describe("which bookings may be moved", () => {
  it("refuses a cancelled, refunded or completed booking", () => {
    expect(route).toContain('const CLOSED = ["CANCELLED", "REFUNDED", "COMPLETED"]');
    expect(route).toContain("CLOSED.includes(booking.status)");
    expect(route).toContain("{ status: 409 }");
  });

  it("rejects a date and time that is not real", () => {
    expect(route).toContain("pickupToUtc(body.date, body.time)");
    expect(route).toContain("That is not a real date and time.");
  });
});

describe("nothing is written before the office confirms", () => {
  it("defaults to a preview", () => {
    expect(route).toContain("confirm: z.boolean().default(false)");
  });

  it("returns the quote and stops when not confirmed", () => {
    const i = route.indexOf("if (!body.confirm)");
    expect(i).toBeGreaterThan(-1);
    // The update must come after the early return, never before it.
    expect(route.indexOf("prisma.booking.update")).toBeGreaterThan(i);
  });

  it("lets the office waive the price change", () => {
    expect(route).toContain("applyPriceChange: z.boolean().default(true)");
    expect(route).toContain("body.applyPriceChange && priced.difference !== 0");
  });
});

describe("money", () => {
  it("does not rewrite a balance that has already been collected", () => {
    expect(route).toContain("booking.balancePaidAt == null");
  });

  it("puts the difference on the balance, not the deposit", () => {
    expect(route).toContain("applyToBalance(booking, priced.difference)");
    expect(route).not.toMatch(/depositAmount:\s*priced/);
  });
});

describe("telling the customer", () => {
  it("emails them by default", () => {
    expect(route).toContain("notifyCustomer: z.boolean().default(true)");
    expect(route).toContain("sendBookingRescheduledEmail");
  });

  /** A mail problem must not undo a change the office has already made. */
  it("does not let a failed email roll back the move", () => {
    const send = route.slice(route.indexOf("sendBookingRescheduledEmail"));
    expect(send).toContain(".catch(");
  });
});
