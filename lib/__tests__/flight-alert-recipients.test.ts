import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A flight delay has to reach whoever is going to be standing at arrivals.
 *
 * Three things went wrong with the sweep, none of them visible from outside:
 *  - one shared "already told" check meant a driver assigned after the customer
 *    had been notified was never told, because the whole booking was skipped;
 *  - a job sent to a fleet company has no driver until the company names one,
 *    so for that stretch nobody on the job heard the flight had moved;
 *  - once the check became per recipient, the office alert would have repeated
 *    on every hourly run unless it too waited for something new.
 */
const src = readFileSync(join(__dirname, "..", "flights", "sweep.ts"), "utf-8");

describe("who hears about a delay", () => {
  it("checks each recipient on their own, not the booking as a whole", () => {
    expect(src).toContain('announced("NOTIFY_FLIGHT_DELAYED")');
    expect(src).toContain('announced("NOTIFY_FLIGHT_DELAYED_DRIVER", b.driver.userId)');
    expect(src).not.toMatch(/if \(previousWhen === when\) continue;/);
  });

  it("tells a fleet company's driver through the same channels as any driver", () => {
    expect(src).toContain('event:     "FLIGHT_DELAYED_DRIVER"');
    expect(src).toContain("userId:    b.driver.userId");
    expect(src).toContain("to:               driverMailTo(b.driver!)");
  });

  it("tells the fleet company itself while no driver is named", () => {
    expect(src).toMatch(/!b\.driver && b\.partner\?\.active/);
    expect(src).toContain("to:               b.partner!.email");
  });

  it("does not repeat the office alert when nobody new was told", () => {
    expect(src).toMatch(/if \(!fresh\) continue;/);
    expect(src.indexOf("if (!fresh) continue;")).toBeLessThan(src.indexOf("3. Operations"));
  });
});
