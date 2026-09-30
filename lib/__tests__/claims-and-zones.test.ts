import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIXED_ROUTES } from "@/lib/fixed-prices";

/**
 * Two classes of bug, each caught once and each cheap to reintroduce.
 *
 * 1. A state transition read before it is written. Three paths call into
 *    payment completion and SumUp retries on any non-2xx, so two callers can
 *    both read "not paid yet" and both proceed. Everything past that point
 *    then runs twice, including the conversion the Ads bidding optimises on.
 *
 * 2. A fixed-route zone that only one spelling of an address can reach.
 *    girona_city matched an address that *started* with "Girona", which is
 *    not what an address box returns for a hotel, so the route was never
 *    found and the fare fell to per-km: €327 against the €165 on the route.
 */

const ROOT = join(__dirname, "..", "..");
const completion = readFileSync(join(ROOT, "lib", "payment-completion.ts"), "utf-8");
const pricing = readFileSync(join(ROOT, "lib", "pricing.ts"), "utf-8");

/** The body of a named exported function, up to the next one. */
function fnBody(src: string, signature: string): string {
  const start = src.indexOf(signature);
  expect(start, `${signature} is missing`).toBeGreaterThan(-1);
  const next = src.indexOf("\nexport async function", start + signature.length);
  return src.slice(start, next === -1 ? src.length : next);
}

describe("a payment is claimed before it is acted on", () => {
  const FINALIZERS = [
    ["export async function finalizeSumUpPayment(", "paymentStatus"],
    ["export async function finalizeBalancePayment(", "balancePaidAt"],
    ["export async function markSumUpPaymentFailed(", "paymentStatus"],
  ] as const;

  for (const [signature, field] of FINALIZERS) {
    const name = signature.match(/function (\w+)/)![1];

    it(`${name} claims the row with a conditional update`, () => {
      const fn = fnBody(completion, signature);
      expect(fn).toContain("updateMany");
      expect(fn).toMatch(new RegExp(`where:\\s*\\{[^}]*${field}`));
    });

    it(`${name} stops when it loses the claim`, () => {
      const fn = fnBody(completion, signature);
      expect(fn).toMatch(/count === 0/);
      // The finalizers report it; markSumUpPaymentFailed returns void.
      expect(fn).toMatch(/return "already-paid"|count === 0\) return;/);
    });

    /**
     * The early read is a cheap exit, not the lock. If the unconditional
     * update comes back, the race comes back with it.
     */
    it(`${name} does not write the transition with a bare update`, () => {
      const fn = fnBody(completion, signature);
      const bare = /prisma\.booking\.update\(\{\s*where:\s*\{\s*id:/;
      expect(bare.test(fn), `${name} writes with an unconditional update`).toBe(false);
    });
  }

  /**
   * The claim has to happen before the conversion, not after — that ordering
   * is the whole point of it. Matched on the call rather than the words,
   * because "order_created" also appears in the comment banner above it.
   */
  /**
   * A failure must never be able to overwrite a payment that succeeded. The
   * two run concurrently — SumUp retries the webhook while the reconcile cron
   * is also checking — so a late-landing FAILED would hide a paid job from
   * the office and tell the customer their card was declined.
   */
  it("cannot stamp FAILED over a booking that is already PAID", () => {
    const fn = fnBody(completion, "export async function markSumUpPaymentFailed(");
    expect(fn).toMatch(/paymentStatus:\s*\{\s*notIn:\s*\[\s*"PAID"/);
  });

  it("claims the booking before reporting the conversion", () => {
    const fn = fnBody(completion, "export async function finalizeSumUpPayment(");
    const claim = fn.indexOf("updateMany");
    const report = fn.indexOf("reportOrderCreated(");
    expect(claim, "no claim found").toBeGreaterThan(-1);
    expect(report, "no conversion call found").toBeGreaterThan(-1);
    expect(claim).toBeLessThan(report);
  });
});

describe("every fixed-route zone can actually be reached", () => {
  /**
   * A zone with neither coordinates nor a rule that matches a real address is
   * a route nobody can be quoted. Coordinates are the reliable half — the
   * address box always sends them, and they cannot confuse a city with the
   * province of the same name.
   */
  const coordBlock = pricing.slice(
    pricing.indexOf("KNOWN_LOCATIONS"),
    pricing.indexOf("Coordinate-based zone detection"),
  );
  const withCoords = new Set(
    [...coordBlock.matchAll(/^\s*([a-z_]+):\s*\{\s*lat:/gm)].map((m) => m[1]),
  );
  const codeToKey: Record<string, string> = {};
  for (const m of pricing.matchAll(/^\s*([A-Z_]+):\s*"([a-z_]+)",/gm)) codeToKey[m[1]] = m[2];

  it("gives the Girona city zone coordinates, since its text rule cannot match a hotel", () => {
    expect(withCoords.has("girona_city")).toBe(true);
  });

  /**
   * The signature of the bug: a rule anchored to the start of the address.
   * An address box returns "Hotel, Street, City, Region" — the city is never
   * first, so an anchored rule only matches someone typing the bare city name.
   *
   * Anchoring is not itself wrong. Girona keeps its anchored rule, because
   * loosening it to a bare "girona" would swallow the whole province: Olot
   * and Banyoles both carry "Girona" in their postal address and both are
   * 30-55 km further on. What is wrong is anchoring with nothing behind it.
   * So the rule is: an anchored zone must also be reachable by coordinates.
   */
  it("backs every anchored zone rule with coordinates", () => {
    const anchored = pricing
      .split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /if \(\/\^[a-z]/.test(line) && /return "/.test(line));

    const unbacked = anchored
      .map(([n, line]) => [n, line.match(/return "([a-z_]+)"/)?.[1] ?? "?"] as const)
      .filter(([, zone]) => !withCoords.has(zone));

    expect(
      unbacked.map(([n, zone]) => `pricing.ts:${n} anchors ${zone} with no coordinates`),
    ).toEqual([]);
  });

  /** Both ends of every priced route must resolve to something. */
  it("maps every route endpoint to a zone key", () => {
    const unmapped = new Set<string>();
    for (const route of FIXED_ROUTES) {
      for (const code of [route.from, route.to]) {
        if (!codeToKey[code]) unmapped.add(code);
      }
    }
    expect([...unmapped]).toEqual([]);
  });
});
