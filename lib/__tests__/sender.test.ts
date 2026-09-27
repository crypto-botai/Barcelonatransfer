import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * A misconfigured sender must not be an outage.
 *
 * RESEND_FROM was set, in production, to the Resend API key — pasted into the
 * field above the one it was meant for. Every send would then have carried
 * a from address beginning "re_", which is not an address, and the entire business's
 * outgoing email hung on one value in a dashboard being typed into the right
 * box. A wrong sender is a configuration mistake; it should not also stop
 * every booking confirmation, password reset and lead alert.
 */
describe("the sender address", () => {
  const OLD = process.env.RESEND_FROM;
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { if (OLD === undefined) delete process.env.RESEND_FROM; else process.env.RESEND_FROM = OLD; });

  const load = async () => (await import("@/lib/sender"));

  it("uses the built-in sender when nothing is configured", async () => {
    delete process.env.RESEND_FROM;
    const { senderAddress, senderIsMisconfigured } = await load();
    expect(senderAddress()).toBe("Elite BCN Transfers <noreply@elitebcn.info>");
    expect(senderIsMisconfigured()).toBe(false);
  });

  it("accepts both shapes Resend takes", async () => {
    for (const v of ["ops@elitebcn.info", "Elite BCN <ops@elitebcn.info>"]) {
      process.env.RESEND_FROM = v;
      vi.resetModules();
      const { senderAddress, senderIsMisconfigured } = await load();
      expect(senderAddress(), v).toBe(v);
      expect(senderIsMisconfigured(), v).toBe(false);
    }
  });

  /** The exact mistake that prompted this. */
  it("ignores an API key pasted into the sender field", async () => {
    process.env.RESEND_FROM = "re_EXAMPLEKEY_notARealResendKey00";
    const { senderAddress, senderIsMisconfigured } = await load();
    expect(senderAddress()).toBe("Elite BCN Transfers <noreply@elitebcn.info>");
    expect(senderIsMisconfigured()).toBe(true);
  });

  it("ignores anything else that is not an address", async () => {
    for (const v of ["noreply", "noreply@localhost", "  ", "http://elitebcn.info"]) {
      process.env.RESEND_FROM = v;
      vi.resetModules();
      const { senderAddress } = await load();
      expect(senderAddress(), v).toBe("Elite BCN Transfers <noreply@elitebcn.info>");
    }
  });

  it("honours a caller's own fallback, for the AI sender", async () => {
    process.env.RESEND_FROM = "re_bad_key";
    const { senderAddress } = await load();
    expect(senderAddress("Elite BCN AI <noreply@elitebcn.info>")).toBe("Elite BCN AI <noreply@elitebcn.info>");
  });
});

describe("every sender goes through the guard", () => {
  it("no route reads RESEND_FROM raw", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const ROOT = join(__dirname, "..", "..");
    for (const f of [
      "lib/resend.ts", "app/api/contact/route.ts", "app/api/auth/forgot-password/route.ts",
      "app/api/newsletter/subscribe/route.ts", "app/api/admin/settings/test-email/route.ts",
      "lib/ai/agents/booking.ts", "lib/ai/alerts.ts",
    ]) {
      expect(readFileSync(join(ROOT, f), "utf-8"), f).not.toContain("process.env.RESEND_FROM");
    }
  });
});
