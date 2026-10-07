import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The booking handler has a dry run for the mobile apps: the price, to the cent,
 * with nothing written. The promise is only worth anything if nothing is written
 * before it returns, and if the live booking path is unchanged. Both are checked
 * on the source, because the handler cannot run without a database.
 */
const src = readFileSync(join(__dirname, "..", "..", "app", "api", "bookings", "route.ts"), "utf8");
const post = src.slice(src.indexOf("export async function POST"));
const dry = post.indexOf("if (body.dryRun)");

describe("the booking dry run", () => {
  it("exists, after the payment plan and before anything is created", () => {
    expect(dry).toBeGreaterThan(0);
    expect(post.indexOf("const plan = paymentPlan(")).toBeLessThan(dry);
    expect(post.indexOf("prisma.booking.create")).toBeGreaterThan(dry);
  });

  it("writes nothing and sends nothing before it returns", () => {
    const before = post.slice(0, dry);
    expect(before).not.toMatch(/prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/);
    expect(before).not.toMatch(/\b(sendBookingConfirmation|sendWelcomeEmail|sendJourneysConfirmation|notify|createSumUpCheckout|redeemCoupon)\(/);
  });

  it("is off unless asked for, so every existing caller behaves as before", () => {
    expect(src).toMatch(/dryRun:\s+z\.boolean\(\)\.default\(false\)/);
  });
});
